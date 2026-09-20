import { supabase } from '../lib/supabaseClient';
import { getPodContext, FALLBACK_POD_ID } from './podContext';
import { getIstDateString, getIstOffsetDateString } from '../utils/dateUtils';
import { ClinicalNotificationService } from './clinicalNotificationService';
import { safeGetStorageJSON } from '../utils/storage';

export interface ChronicConditionProtocol {
  code: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  standardSupplyDays: number;
  mandatoryRetestCode: string;
  mandatoryRetestName: string;
  retestFrequencyDays: number;
  adherenceRiskTier: 'critical' | 'high' | 'moderate' | 'low';
  commonDrugs: string[];
}

export const CHRONIC_PROTOCOLS: Record<string, ChronicConditionProtocol> = {
  DIABETES: {
    code: 'DIABETES',
    name: 'Type-2 Diabetes Mellitus',
    category: 'Endocrine & Metabolic',
    icon: '🩸',
    color: 'emerald',
    standardSupplyDays: 30,
    mandatoryRetestCode: '4544-3',
    mandatoryRetestName: 'HbA1c & Fasting Glucose Panel',
    retestFrequencyDays: 90,
    adherenceRiskTier: 'high',
    commonDrugs: ['Metformin', 'Glimepiride', 'Sitagliptin', 'Dapagliflozin', 'Vildagliptin', 'Insulin', 'Teneligliptin', 'Glipizide']
  },
  HYPERTENSION: {
    code: 'HYPERTENSION',
    name: 'Essential Hypertension',
    category: 'Cardiovascular',
    icon: '🫀',
    color: 'rose',
    standardSupplyDays: 30,
    mandatoryRetestCode: '2160-0',
    mandatoryRetestName: 'Serum Electrolytes & Creatinine',
    retestFrequencyDays: 90,
    adherenceRiskTier: 'critical',
    commonDrugs: ['Telmisartan', 'Amlodipine', 'Losartan', 'Enalapril', 'Olmesartan', 'Hydrochlorothiazide', 'Bisoprolol', 'Metoprolol', 'Atenolol']
  },
  THYROID: {
    code: 'THYROID',
    name: 'Hypothyroidism / Thyroid Disorders',
    category: 'Endocrine & Metabolic',
    icon: '🦋',
    color: 'purple',
    standardSupplyDays: 60,
    mandatoryRetestCode: '3016-3',
    mandatoryRetestName: 'Thyroid Function Test (T3, T4, TSH)',
    retestFrequencyDays: 90,
    adherenceRiskTier: 'moderate',
    commonDrugs: ['Thyronorm', 'Eltroxin', 'Levothyroxine', 'Thyroxine', 'Neo-Mercazole', 'Methimazole']
  },
  CARDIAC: {
    code: 'CARDIAC',
    name: 'Ischemic Heart Disease (CAD / Stent)',
    category: 'Cardiovascular',
    icon: '💓',
    color: 'red',
    standardSupplyDays: 30,
    mandatoryRetestCode: '2093-3',
    mandatoryRetestName: 'Comprehensive Lipid Profile',
    retestFrequencyDays: 90,
    adherenceRiskTier: 'critical',
    commonDrugs: ['Atorvastatin', 'Rosuvastatin', 'Clopidogrel', 'Ecosprin', 'Aspirin', 'Nitroglycerin', 'Isosorbide', 'Ticagrelor']
  },
  RESPIRATORY: {
    code: 'RESPIRATORY',
    name: 'Asthma & COPD',
    category: 'Pulmonary',
    icon: '🫁',
    color: 'cyan',
    standardSupplyDays: 60,
    mandatoryRetestCode: '1989-3',
    mandatoryRetestName: 'Spirometry & Peak Flow Analysis',
    retestFrequencyDays: 180,
    adherenceRiskTier: 'high',
    commonDrugs: ['Budesonide', 'Formoterol', 'Foracort', 'Montelukast', 'Levocetirizine', 'Salbutamol', 'Ipratropium', 'Deriphyllin']
  },
  ARTHRITIS: {
    code: 'ARTHRITIS',
    name: 'Osteoarthritis & Rheumatoid Arthritis',
    category: 'Rheumatology',
    icon: '🦴',
    color: 'amber',
    standardSupplyDays: 30,
    mandatoryRetestCode: '30522-7',
    mandatoryRetestName: 'Serum Calcium, Vitamin D3 & ESR',
    retestFrequencyDays: 60,
    adherenceRiskTier: 'moderate',
    commonDrugs: ['Calcium + D3', 'Shelcal', 'Methotrexate', 'HCQS', 'Deflazacort', 'Etoricoxib', 'Paracetamol', 'Glucosamine']
  },
  CKD: {
    code: 'CKD',
    name: 'Chronic Kidney Disease (Stage 1-3)',
    category: 'Renal & Nephrology',
    icon: '🧪',
    color: 'blue',
    standardSupplyDays: 30,
    mandatoryRetestCode: '33914-3',
    mandatoryRetestName: 'Renal Function Panel (eGFR, Urea, Creatinine)',
    retestFrequencyDays: 45,
    adherenceRiskTier: 'critical',
    commonDrugs: ['Alpha Ketoanalogue', 'Ketosteril', 'Febuxostat', 'Torsemide', 'Sodium Bicarbonate', 'Iron Sucrose', 'Erythropoietin']
  },
  EPILEPSY: {
    code: 'EPILEPSY',
    name: 'Epilepsy & Seizure Disorders',
    category: 'Neurology',
    icon: '⚡',
    color: 'indigo',
    standardSupplyDays: 30,
    mandatoryRetestCode: '1742-6',
    mandatoryRetestName: 'Therapeutic Drug Monitoring & LFT',
    retestFrequencyDays: 90,
    adherenceRiskTier: 'critical',
    commonDrugs: ['Levetiracetam', 'Levipil', 'Sodium Valproate', 'Encorate', 'Oxcarbazepine', 'Clobazam', 'Pregabalin', 'Gabapentin']
  }

};

export interface ChronicCohortRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  podId: string;
  conditionCode: string;
  conditionName: string;
  medications: Array<{ name: string; dosage: string; frequency?: string; count?: number }>;
  daysSupply: number;
  dispensedAt: string;
  nextRefillDate: string;
  nextRetestDate?: string;
  retestTestCode?: string;
  retestTestName?: string;
  adherenceScore: number;
  status: 'active' | 'due_refill' | 'defaulter_7d' | 'defaulter_15d' | 'resolved';
  monthlyMedicineSpend: number;
  careProgramStatus?: 'enrolled' | 'not_enrolled';
  careProgramFee?: number;
}

export interface ChronicCareSubscription {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId?: string;
  podId: string;
  programName: string;
  durationMonths: number;
  totalFee: number;
  monthlyVirtualVisits: number;
  visitsUsed: number;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  nextVirtualConsultDate?: string;
  createdAt: string;
}

export class ChronicCareService {
  /**
   * Parse chronic disease category from prescription text or diagnoses
   */
  public static detectChronicCondition(prescriptionText: string, diagnosisText: string): ChronicConditionProtocol | null {
    const combined = `${prescriptionText} ${diagnosisText}`.toLowerCase();

    // High-precision clinical keyword and acronym matching
    if (/\b(diabet|t2dm|dm2|sugar|hyperglycem|glycem)\b/i.test(combined)) return CHRONIC_PROTOCOLS.DIABETES;
    if (/\b(hypertens|htn|high\s*bp|blood\s*pressure)\b/i.test(combined)) return CHRONIC_PROTOCOLS.HYPERTENSION;
    if (/\b(thyroid|hypothyroid|tsh|goiter)\b/i.test(combined)) return CHRONIC_PROTOCOLS.THYROID;
    if (/\b(cad|ihd|cardiac|stent|dyslipid|cholesterol|angina|infarct)\b/i.test(combined)) return CHRONIC_PROTOCOLS.CARDIAC;
    if (/\b(asthma|copd|bronch|wheez)\b/i.test(combined)) return CHRONIC_PROTOCOLS.RESPIRATORY;
    if (/\b(arthrit|joint\s*pain|osteoarth|rheumatoid)\b/i.test(combined)) return CHRONIC_PROTOCOLS.ARTHRITIS;
    if (/\b(ckd|kidney|creatinine|renal)\b/i.test(combined)) return CHRONIC_PROTOCOLS.CKD;
    if (/\b(epilep|seizur|fits|convuls)\b/i.test(combined)) return CHRONIC_PROTOCOLS.EPILEPSY;

    for (const key of Object.keys(CHRONIC_PROTOCOLS)) {
      const protocol = CHRONIC_PROTOCOLS[key];
      if (combined.includes(protocol.name.toLowerCase()) || combined.includes(protocol.code.toLowerCase())) {
        return protocol;
      }
      for (const drug of protocol.commonDrugs) {
        if (combined.includes(drug.toLowerCase())) {
          return protocol;
        }
      }
    }
    return null;
  }

  /**
   * Calculate Days Supply based on dosage string and total tablet count
   */
  public static calculateDaysSupply(dosageStr: string, totalCount: number = 30): number {
    let pillsPerDay = 1;
    const clean = (dosageStr || '').replace(/\s+/g, '');
    if (clean.includes('1-0-1') || clean.includes('1-1-0') || clean.includes('0-1-1')) {
      pillsPerDay = 2;
    } else if (clean.includes('1-1-1')) {
      pillsPerDay = 3;
    } else if (clean.includes('1-0-0') || clean.includes('0-0-1') || clean.includes('0-1-0')) {
      pillsPerDay = 1;
    } else if (clean.includes('1/2') || clean.includes('half')) {
      pillsPerDay = 0.5;
    }
    const safeCount = Number(totalCount) > 0 ? Number(totalCount) : 30;
    const safePills = pillsPerDay > 0 ? pillsPerDay : 1;
    return Math.max(7, Math.floor(safeCount / safePills));
  }

  /**
   * Get dynamic Care Program fee from active Doctor SOP configuration
   */
  public static getCareProgramFee(durationMonths: number = 6): number {
    try {
      if (durationMonths === 3) {
        const custom3m = localStorage.getItem('clinic_care_program_3m_fee');
        if (custom3m && !isNaN(Number(custom3m))) return Number(custom3m);
        return 4000;
      }
      const custom6m = localStorage.getItem('clinic_care_program_6m_fee');
      if (custom6m && !isNaN(Number(custom6m))) return Number(custom6m);
      return 6000;
    } catch {
      return durationMonths === 3 ? 4000 : 6000;
    }
  }

  /**
   * Fetch chronic cohorts for active pod
   */
  public static async getChronicCohorts(): Promise<ChronicCohortRecord[]> {
    const pod = getPodContext();
    const podId = pod?.podId || FALLBACK_POD_ID;

    try {
      const { data, error } = await supabase
        .from('chronic_care_cohorts')
        .select('*')
        .eq('pod_id', podId)
        .order('next_refill_date', { ascending: true });

      if (!error && data) {
        const mapped = data.map(row => ({
          id: row.id,
          patientId: row.patient_id,
          patientName: row.patient_name,
          patientPhone: row.patient_phone || '',
          doctorId: row.doctor_id,
          podId: row.pod_id,
          conditionCode: row.condition_code,
          conditionName: row.condition_name,
          medications: row.medications || [],
          daysSupply: row.days_supply,
          dispensedAt: row.dispensed_at,
          nextRefillDate: row.next_refill_date,
          nextRetestDate: row.next_retest_date,
          retestTestCode: row.retest_test_code,
          retestTestName: row.retest_test_name,
          adherenceScore: Number(row.adherence_score) || 100,
          status: row.status,
          monthlyMedicineSpend: Number(row.monthly_medicine_spend) || 0,
          careProgramStatus: row.care_program_status || 'not_enrolled',
          careProgramFee: Number(row.care_program_fee) || 4000
        }));

        // Also merge any patients from patient_registry marked as chronic who aren't yet in cohorts
        try {
          const { data: registryChronic } = await supabase
            .from('patient_registry')
            .select('id, name, phone, is_chronic, chronic_conditions, is_care_program_enrolled, care_program_id')
            .eq('pod_id', podId)
            .eq('is_chronic', true);

          if (registryChronic && registryChronic.length > 0) {
            for (const regPat of registryChronic) {
              const alreadyIn = mapped.some(m => m.patientId === regPat.id);
              if (!alreadyIn) {
                const condName = (regPat.chronic_conditions && regPat.chronic_conditions[0]) || 'Type-2 Diabetes Mellitus';
                const matchedProto = Object.values(CHRONIC_PROTOCOLS).find(p => p.name.toLowerCase() === condName.toLowerCase()) || CHRONIC_PROTOCOLS.DIABETES;
                mapped.push({
                  id: `cohort-${regPat.id}`,
                  patientId: regPat.id,
                  patientName: regPat.name || 'Chronic Patient',
                  patientPhone: regPat.phone || '',
                  doctorId: pod?.doctorId || '',
                  podId: podId,
                  conditionCode: matchedProto.code,
                  conditionName: matchedProto.name,
                  medications: matchedProto.commonDrugs.slice(0, 2).map(d => ({ name: d, dosage: '1-0-1', frequency: 'Twice daily' })),
                  daysSupply: matchedProto.standardSupplyDays,
                  dispensedAt: new Date().toISOString(),
                  nextRefillDate: getIstOffsetDateString(25),
                  nextRetestDate: getIstOffsetDateString(matchedProto.retestFrequencyDays),
                  retestTestCode: matchedProto.mandatoryRetestCode,
                  retestTestName: matchedProto.mandatoryRetestName,
                  adherenceScore: 95.0,
                  status: 'active',
                  monthlyMedicineSpend: 1500,
                  careProgramStatus: regPat.is_care_program_enrolled ? 'enrolled' : 'not_enrolled',
                  careProgramFee: 4000
                });
              }
            }
          }
        } catch (_regErr) { /* ignore */ }

        // 🌟 TIER 3: Auto-sync locally registered patients with chronicConditions into Care Club
        // This catches patients created via OCR scan, compounder desk, or WhatsApp onboarding
        try {
          const { PatientService: localPatientService } = await import('./patientService').catch(() => ({ PatientService: null }));
          const localPatients = localPatientService ? (localPatientService as any).getPatients?.() || [] : [];
          const newAutoIngests: Promise<boolean>[] = [];
          for (const lp of localPatients) {
            const isChronicLocal = lp.isChronic || lp.is_chronic || ((lp.chronicConditions || []).length > 0);
            if (!isChronicLocal) continue;
            const alreadyInMapped = mapped.some(m => m.patientId === lp.id);
            if (alreadyInMapped) continue;
            // Auto-detect correct protocol from chronicConditions strings
            const condString = (lp.chronicConditions || []).join(' ').toLowerCase();
            const medText = condString;
            const detectedProto = this.detectChronicCondition(medText, condString) || CHRONIC_PROTOCOLS.DIABETES;
            const condName = (lp.chronicConditions || [])[0] || detectedProto.name;
            // Add to mapped immediately for UI responsiveness
            mapped.push({
              id: `cohort-local-${lp.id}`,
              patientId: lp.id,
              patientName: lp.name || 'Chronic Patient',
              patientPhone: (lp.phone || '').replace(/\D/g, '').slice(-10),
              doctorId: pod?.doctorId || '',
              podId: podId,
              conditionCode: detectedProto.code,
              conditionName: condName,
              medications: detectedProto.commonDrugs.slice(0, 2).map(d => ({ name: d, dosage: '1-0-1', frequency: 'Twice daily' })),
              daysSupply: detectedProto.standardSupplyDays,
              dispensedAt: new Date().toISOString(),
              nextRefillDate: getIstOffsetDateString(25),
              nextRetestDate: getIstOffsetDateString(detectedProto.retestFrequencyDays),
              retestTestCode: detectedProto.mandatoryRetestCode,
              retestTestName: detectedProto.mandatoryRetestName,
              adherenceScore: 95.0,
              status: 'active',
              monthlyMedicineSpend: 1500,
              careProgramStatus: lp.isCareProgramEnrolled ? 'enrolled' : 'not_enrolled',
              careProgramFee: 4000
            });
            // Persist to Supabase in background (non-blocking)
            newAutoIngests.push(this.registerChronicPatient({
              patientId: lp.id,
              patientName: lp.name,
              patientPhone: (lp.phone || '').replace(/\D/g, '').slice(-10),
              doctorId: pod?.doctorId || '',
              conditionCode: detectedProto.code,
              conditionName: condName,
              medications: [],
              daysSupply: detectedProto.standardSupplyDays,
              dispensedAt: new Date().toISOString(),
              nextRefillDate: getIstOffsetDateString(25),
              nextRetestDate: getIstOffsetDateString(detectedProto.retestFrequencyDays),
              retestTestCode: detectedProto.mandatoryRetestCode,
              retestTestName: detectedProto.mandatoryRetestName,
              adherenceScore: 100.0,
              status: 'active',
              monthlyMedicineSpend: 1500
            }));
          }
          if (newAutoIngests.length > 0) {
            console.log(`[ChronicCareService] 🌟 Auto-ingested ${newAutoIngests.length} local chronic patients into Care Club`);
            Promise.allSettled(newAutoIngests); // fire-and-forget
          }
        } catch (_localErr) { /* ignore */ }

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('chronic_care_cohorts', JSON.stringify(mapped));
          } catch (_e) { /* ignore */ }
        }
        return mapped;
      }

      // Check offline cache first
      const cached = safeGetStorageJSON<ChronicCohortRecord[]>('chronic_care_cohorts', []);
      if (cached && cached.length > 0) {
        return cached;
      }

      // Check if current user is on demo account
      let isDemoAccount = false;
      if (typeof window !== 'undefined') {
        const profile = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
        isDemoAccount = profile?.isDemo === true || profile?.email === 'demo@mediflow.com';
      }

      if (isDemoAccount) {
        return this.getFallbackMockCohorts();
      }

      return [];
    } catch (err) {
      console.warn('[ChronicCareService] Error loading chronic cohorts:', err);
      const cached = safeGetStorageJSON<ChronicCohortRecord[]>('chronic_care_cohorts', []);
      return cached || [];
    }
  }

  /**
   * Register or update a patient in chronic cohorts
   */
  public static async registerChronicPatient(record: Partial<ChronicCohortRecord>): Promise<boolean> {
    const pod = getPodContext();
    const podId = pod?.podId || record.podId || '';
    const cleanPhone = (record.patientPhone || '').replace(/\D/g, '').slice(-10);

    try {
      const { error } = await supabase
        .from('chronic_care_cohorts')
        .upsert([{
          id: record.id || `cohort-${record.patientId || crypto.randomUUID().slice(0, 8)}`,
          patient_id: record.patientId,
          patient_name: record.patientName,
          patient_phone: cleanPhone,
          doctor_id: record.doctorId || pod?.doctorId || null,
          pod_id: podId,
          condition_code: record.conditionCode || 'DIABETES',
          condition_name: record.conditionName || 'Type-2 Diabetes Mellitus',
          medications: record.medications || [],
          days_supply: record.daysSupply || 30,
          dispensed_at: record.dispensedAt || new Date().toISOString(),
          next_refill_date: record.nextRefillDate || getIstOffsetDateString(25),
          next_retest_date: record.nextRetestDate || getIstOffsetDateString(75),
          retest_test_code: record.retestTestCode || '4544-3',
          retest_test_name: record.retestTestName || 'HbA1c & Fasting Glucose Panel',
          adherence_score: record.adherenceScore || 100.0,
          status: record.status || 'active',
          monthly_medicine_spend: record.monthlyMedicineSpend || 1200
        }], { onConflict: 'id' });

      if (record.patientId) {
        try {
          await supabase
            .from('patient_registry')
            .update({
              is_chronic: true,
              chronic_conditions: [record.conditionName || 'Type-2 Diabetes Mellitus']
            })
            .eq('id', record.patientId);
        } catch (_regErr) {
          console.warn('[ChronicCareService] patient_registry update notice:', _regErr);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediflow-chronic-update', {
          detail: { patientId: record.patientId, conditionCode: record.conditionCode }
        }));
        window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      }

      return !error;
    } catch (err) {
      console.error('[ChronicCareService] Registration error:', err);
      return false;
    }
  }

  /**
   * Universal Auto-Ingest: Automatically detect chronic condition from EMR or Paper consultation,
   * register in chronic cohorts, update registry, dispatch ICMR diet guide, and trigger real-time sync.
   */
  public static async autoIngestFromEncounter(params: {
    patientId: string;
    patientName: string;
    patientPhone?: string;
    doctorId?: string;
    diagnosis?: string;
    clinicalNotes?: string;
    medications: Array<{ medicineName?: string; name?: string; dosage?: string; frequency?: string; count?: number }>;
    isChronic?: boolean;
    chronicConditions?: string[];
  }): Promise<{ enrolled: boolean; protocol?: ChronicConditionProtocol; daysSupply?: number }> {
    try {
      const medText = (params.medications || []).map(m => m.medicineName || m.name || '').join(' ');
      const diagText = `${params.diagnosis || ''} ${params.clinicalNotes || ''} ${(params.chronicConditions || []).join(' ')}`;
      const detectedProto = this.detectChronicCondition(medText, diagText);

      const isChronic = Boolean(
        detectedProto || 
        params.isChronic || 
        (params.chronicConditions && params.chronicConditions.length > 0)
      );

      if (!isChronic) {
        return { enrolled: false };
      }

      const proto = detectedProto || CHRONIC_PROTOCOLS.DIABETES;
      const firstDosage = params.medications?.[0]?.dosage || '1-0-1';
      const totalDaysSupply = this.calculateDaysSupply(firstDosage, 30);
      const nextRefill = getIstOffsetDateString(Math.max(1, totalDaysSupply - 5));
      const nextRetest = getIstOffsetDateString(proto.retestFrequencyDays || 75);

      const registered = await this.registerChronicPatient({
        patientId: params.patientId,
        patientName: params.patientName,
        patientPhone: params.patientPhone || '',
        doctorId: params.doctorId,
        conditionCode: proto.code,
        conditionName: proto.name,
        medications: (params.medications || []).map(m => ({
          name: m.medicineName || m.name || '',
          dosage: m.dosage || '1-0-1',
          frequency: m.frequency || 'Twice daily'
        })),
        daysSupply: totalDaysSupply,
        dispensedAt: new Date().toISOString(),
        nextRefillDate: nextRefill,
        nextRetestDate: nextRetest,
        retestTestCode: proto.mandatoryRetestCode,
        retestTestName: proto.mandatoryRetestName,
        adherenceScore: 100.0,
        status: 'active',
        monthlyMedicineSpend: 1500
      });

      // Auto-dispatch ICMR / ADA diet chart on WhatsApp
      if (params.patientPhone) {
        await this.dispatchConditionDietGuide(
          params.patientPhone,
          proto.code,
          params.patientName
        );
      }

      // Emit real-time synchronization events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mediflow-chronic-update', {
          detail: { patientId: params.patientId, conditionCode: proto.code, conditionName: proto.name }
        }));
        window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      }

      return { enrolled: registered, protocol: proto, daysSupply: totalDaysSupply };
    } catch (err) {
      console.error('[ChronicCareService] autoIngestFromEncounter error:', err);
      return { enrolled: false };
    }
  }

  /**
   * Fallback mock cohorts for seamless UI preview
   */
  public static getFallbackMockCohorts(): ChronicCohortRecord[] {
    const addDays = (d: number) => getIstOffsetDateString(d);

    return [
      {
        id: 'mock-cohort-1',
        patientId: 'p-001',
        patientName: 'Rajesh Kumar Verma',
        patientPhone: '+91 9835012345',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'DIABETES',
        conditionName: 'Type-2 Diabetes Mellitus',
        medications: [
          { name: 'Metformin 500mg (Glycomet)', dosage: '1-0-1' },
          { name: 'Glimepiride 2mg (Amaryl)', dosage: '1-0-0' }
        ],
        daysSupply: 30,
        dispensedAt: addDays(-25),
        nextRefillDate: addDays(5),
        nextRetestDate: addDays(50),
        retestTestCode: '4544-3',
        retestTestName: 'HbA1c & Fasting Glucose Panel',
        adherenceScore: 96.0,
        status: 'due_refill',
        monthlyMedicineSpend: 1450.0
      },
      {
        id: 'mock-cohort-2',
        patientId: 'p-002',
        patientName: 'Sunita Devi Sharma',
        patientPhone: '+91 9431023456',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'HYPERTENSION',
        conditionName: 'Essential Hypertension',
        medications: [
          { name: 'Telmisartan 40mg (Telma)', dosage: '1-0-0' },
          { name: 'Amlodipine 5mg (Amlong)', dosage: '0-0-1' }
        ],
        daysSupply: 30,
        dispensedAt: addDays(-38),
        nextRefillDate: addDays(-8),
        nextRetestDate: addDays(35),
        retestTestCode: '2160-0',
        retestTestName: 'Serum Electrolytes & Creatinine',
        adherenceScore: 72.0,
        status: 'defaulter_7d',
        monthlyMedicineSpend: 980.0
      },
      {
        id: 'mock-cohort-3',
        patientId: 'p-003',
        patientName: 'Anita Gupta',
        patientPhone: '+91 9122034567',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'THYROID',
        conditionName: 'Hypothyroidism',
        medications: [
          { name: 'Thyronorm 50mcg', dosage: '1-0-0 (Empty Stomach)' }
        ],
        daysSupply: 60,
        dispensedAt: addDays(-10),
        nextRefillDate: addDays(50),
        nextRetestDate: addDays(70),
        retestTestCode: '3016-3',
        retestTestName: 'Thyroid Function Test (T3, T4, TSH)',
        adherenceScore: 98.5,
        status: 'active',
        monthlyMedicineSpend: 420.0
      },
      {
        id: 'mock-cohort-4',
        patientId: 'p-004',
        patientName: 'Manoj Kumar Singh',
        patientPhone: '+91 9304045678',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'CARDIAC',
        conditionName: 'Post-PTCA CAD / Dyslipidemia',
        medications: [
          { name: 'Rosuvastatin 20mg (Rosuvas)', dosage: '0-0-1' },
          { name: 'Clopidogrel 75mg (Clopilet)', dosage: '1-0-0' }
        ],
        daysSupply: 30,
        dispensedAt: addDays(-23),
        nextRefillDate: addDays(7),
        nextRetestDate: addDays(55),
        retestTestCode: '2093-3',
        retestTestName: 'Comprehensive Lipid Profile',
        adherenceScore: 94.0,
        status: 'due_refill',
        monthlyMedicineSpend: 2100.0
      },
      {
        id: 'mock-cohort-5',
        patientId: 'p-005',
        patientName: 'Vikramaditya Roy',
        patientPhone: '+91 9709056789',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'RESPIRATORY',
        conditionName: 'Severe Bronchial Asthma',
        medications: [
          { name: 'Foracort 200 Rotacaps', dosage: '1-0-1 (Inhalation)' },
          { name: 'Montelukast 10mg (Montair LC)', dosage: '0-0-1' }
        ],
        daysSupply: 60,
        dispensedAt: addDays(-15),
        nextRefillDate: addDays(45),
        nextRetestDate: addDays(120),
        retestTestCode: '1989-3',
        retestTestName: 'Spirometry & Peak Flow Analysis',
        adherenceScore: 91.0,
        status: 'active',
        monthlyMedicineSpend: 1650.0
      },
      {
        id: 'mock-cohort-6',
        patientId: 'p-006',
        patientName: 'Baidyanath Prasad',
        patientPhone: '+91 9934067890',
        doctorId: 'doc-primary',
        podId: FALLBACK_POD_ID,
        conditionCode: 'ARTHRITIS',
        conditionName: 'Severe Knee Osteoarthritis',
        medications: [
          { name: 'Shelcal HD (Calcium + D3)', dosage: '1-0-0' },
          { name: 'Etoricoxib 90mg (Nucoxia)', dosage: 'SOS (Pain)' }
        ],
        daysSupply: 30,
        dispensedAt: addDays(-42),
        nextRefillDate: addDays(-12),
        nextRetestDate: addDays(18),
        retestTestCode: '30522-7',
        retestTestName: 'Serum Calcium, Vitamin D3 & ESR',
        adherenceScore: 68.0,
        status: 'defaulter_7d',
        monthlyMedicineSpend: 850.0
      }
    ];
  }

  /**
   * Automated Multi-Patient Daily Dosage Reminder Engine
   * Dispatches WhatsApp dose reminders based on prescribed medication frequencies.
   */
  public static async dispatchCohortDailyDosageReminders(
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning'
  ): Promise<{ dispatchedCount: number; recipientNames: string[] }> {
    const cohorts = await this.getChronicCohorts();
    const recipientNames: string[] = [];

    for (const cohort of cohorts) {
      if (!cohort.patientPhone || !cohort.medications || cohort.medications.length === 0) continue;

      // Filter medications relevant to the time of day
      const dueMeds = cohort.medications.filter(med => {
        const d = (med.dosage || '').toLowerCase();
        if (timeOfDay === 'morning') {
          return d.includes('1-0-1') || d.includes('1-0-0') || d.includes('1-1-1') || d.includes('2-0-2') || d.includes('morning');
        }
        if (timeOfDay === 'afternoon') {
          return d.includes('1-1-1') || d.includes('0-1-0') || d.includes('afternoon');
        }
        if (timeOfDay === 'night' || timeOfDay === 'evening') {
          return d.includes('1-0-1') || d.includes('0-0-1') || d.includes('1-1-1') || d.includes('2-0-2') || d.includes('night') || d.includes('bedtime');
        }
        return true;
      });

      if (dueMeds.length > 0) {
        await ClinicalNotificationService.dispatchDailyDosageReminderWhatsApp({
          patientPhone: cohort.patientPhone,
          patientName: cohort.patientName,
          timeOfDay,
          medications: dueMeds.map(m => ({
            name: m.name,
            dosage: m.dosage,
            instruction: 'Dawa khane ke baad lein'
          }))
        });
        recipientNames.push(cohort.patientName);
      }
    }

    return { dispatchedCount: recipientNames.length, recipientNames };
  }

  /**
   * Dispatches an immediate daily dose reminder for an individual patient
   */
  public static async dispatchPatientDosageReminder(
    phone: string,
    patientName: string,
    medications: Array<{ name: string; dosage?: string }>,
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning'
  ): Promise<string> {
    return ClinicalNotificationService.dispatchDailyDosageReminderWhatsApp({
      patientPhone: phone,
      patientName,
      timeOfDay,
      medications: medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        instruction: 'Doctor ki salah ke anusar'
      }))
    });
  }

  /**
   * Enroll a patient in the Care Program Subscription (Retainer)
   */
  public static async enrollInCareProgram(
    patientId: string,
    patientName: string,
    patientPhone: string,
    durationMonths: number = 6,
    feeOverride?: number
  ): Promise<boolean> {
    const pod = getPodContext();
    const podId = pod?.podId || FALLBACK_POD_ID;
    const totalFee = feeOverride ?? this.getCareProgramFee(durationMonths);
    const programName = durationMonths === 3 ? '3-Month Chronic Care Club' : '6-Month Comprehensive Chronic Care Program';
    const subId = `sub-${patientId.slice(0, 8)}-${Date.now()}`;
    const nextVirtualDate = getIstOffsetDateString(30);

    try {
      // 1. Insert into chronic_care_subscriptions
      await supabase.from('chronic_care_subscriptions').insert({
        id: subId,
        patient_id: patientId,
        patient_name: patientName,
        patient_phone: patientPhone,
        doctor_id: pod?.doctorId || null,
        pod_id: podId,
        program_name: programName,
        duration_months: durationMonths,
        total_fee: totalFee,
        monthly_virtual_visits: 1,
        visits_used: 0,
        status: 'active',
        start_date: getIstDateString(),
        next_virtual_consult_date: nextVirtualDate
      });

      // 2. Update patient_registry
      await supabase.from('patient_registry').update({
        is_care_program_enrolled: true,
        care_program_id: subId
      }).eq('id', patientId);

      // 3. Update chronic_care_cohorts
      await supabase.from('chronic_care_cohorts').update({
        care_program_status: 'enrolled',
        care_program_fee: totalFee
      }).eq('patient_id', patientId);

      // 4. Dispatch WhatsApp confirmation to patient
      if (patientPhone) {
        const cleanPhone = patientPhone.replace(/\D/g, '').slice(-10);
        const waMsg = `🌟 *WELCOME TO ${programName.toUpperCase()}!* 🩺\n\nNamaste *${patientName}*!\n\nAapka Doctor Care Club Retainer successfully activate ho gaya hai:\n\n• Program: *${programName}*\n• Duration: *${durationMonths} Months*\n• Retainer Fee: *₹${totalFee}* (Paid)\n• Monthly Virtual Check-in: *1 Free Video Consult / month* (Next: ${nextVirtualDate})\n• 24/7 WhatsApp Care Concierge: *Active* 🤖\n• Chronic Medicine Refills: *10% VIP Discount Guaranteed* 💊\n\nAapka health trajectory ab Dr. ke direct active clinical surveillance mein hai. Kisi bhi sawal ke liye yahan message karein! Dhanyawad! 😊`;
        
        try {
          const { WhatsAppService } = await import('./whatsappService');
          WhatsAppService.pushWhatsAppMessageFromBot(cleanPhone, waMsg);
          await WhatsAppService.sendWhatsAppMessagePayload(cleanPhone, 'custom_text', { replyText: waMsg });
        } catch (_waErr) { /* ignore */ }
      }

      window.dispatchEvent(new CustomEvent('mediflow-chronic-update'));
      window.dispatchEvent(new CustomEvent('mediflow-state-change'));
      return true;
    } catch (err) {
      console.error('[ChronicCareService] Error enrolling in care program:', err);
      return false;
    }
  }

  /**
   * Dispatch Condition-Specific ICMR/ADA Dietary Guide on WhatsApp
   */
  public static async dispatchConditionDietGuide(
    patientPhone: string,
    conditionCode: string,
    patientName: string
  ): Promise<boolean> {
    if (!patientPhone) return false;
    const cleanPhone = patientPhone.replace(/\D/g, '').slice(-10);

    let guideText = "";
    if (conditionCode === 'DIABETES') {
      guideText = `🥗 *ICMR & ADA 2024 DIABETES DIET & LIFESTYLE GUIDE* 🩺\n\nNamaste *${patientName}*! Aapke blood sugar control ke liye doctor-approved guidance:\n\n• *Carb Control:* Maida, meetha, aalu aur safed chawal kam karein. Multigrain roti (Jowar/Bajra/Chana) chunein.\n• *Plate Rule:* Aadhi plate hari sabzi/salad, 1/4 daal/paneer (protein), 1/4 complex carb.\n• *Walking:* Har khane ke 20 minute baad 10-15 min brisk walk karein.\n• *Dose Timing:* Metformin khane ke beech mein ya turant baad lein jisse pet kharab na ho.`;
    } else if (conditionCode === 'HYPERTENSION' || conditionCode === 'CARDIAC') {
      guideText = `🫀 *ACC/AHA & ICMR HYPERTENSION & CARDIAC CARE GUIDE* 🩺\n\nNamaste *${patientName}*! Aapke BP aur heart health ke liye doctor-approved tips:\n\n• *Salt Reduction (DASH Diet):* Namak din bhar mein 1 chammach (<5g) se kam lein. Papad, achar aur namkeen bilkul avoid karein.\n• *Hydration:* Din bhar mein 2.5 - 3 litre paani piyein (unless advised otherwise by kidney doctor).\n• *BP Log:* Subah dawai lene se pehle aur shaam ko BP record karein.\n• *Emergency Alert:* Chest pain, ghabrahat ya pasina aane par turant WhatsApp par 'SOS' reply karein!`;
    } else if (conditionCode === 'THYROID') {
      guideText = `🦋 *THYROID CARE & HORMONE OPTIMIZATION GUIDE* 🩺\n\nNamaste *${patientName}*! Hypothyroidism management ke essential rules:\n\n• *Morning Dose:* Thyronorm/Eltroxin subah bina kuch khaye ek glass gungune paani ke sath lein.\n• *1-Hour Gap:* Dawa lene ke kam se kam 45-60 minute baad hi chai, coffee ya nashta lein.\n• *Calcium/Iron Gap:* Calcium ya iron ki goli thyroid dawa ke kam se kam 4 ghante baad lein.`;
    } else if (conditionCode === 'CKD') {
      guideText = `🧪 *KDIGO RENAL HYDRATION & KIDNEY PROTECTION GUIDE* 💧\n\nNamaste *${patientName}*! Kidney health preservation guidelines:\n\n• *Painkiller Ban:* Bina doctor ki parchi ke Diclofenac / Ibuprofen / Combiflam bilkul na lein!\n• *Protein Balance:* Doctor dwara tay kiye gaye limit mein hi daal/protein lein.\n• *Electrolytes:* High potassium fruits (kela, nariyal paani) lene se pehle doctor se confirm karein.`;
    } else {
      guideText = `🌿 *VITALSYNC CHRONIC WELLNESS & LIFESTYLE GUIDE* 🩺\n\nNamaste *${patientName}*! Doctor dwara nirdharit guidelines:\n\n• Dawa ka schedule regular rakhein aur bina doctor advice ke dose band na karein.\n• Adequate neend (7-8 ghante) aur regular hydration maintain karein.\n• Kisi bhi side-effect ya lakshan mein turant WhatsApp par query bhejein.`;
    }

    try {
      const { WhatsAppService } = await import('./whatsappService');
      WhatsAppService.pushWhatsAppMessageFromBot(cleanPhone, guideText);
      await WhatsAppService.sendWhatsAppMessagePayload(cleanPhone, 'custom_text', { replyText: guideText });
      return true;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Run Autonomous Chronic Agentic Supervisor
   * Performs daily proactive evaluation across all active cohorts in the sovereign pod:
   * 1. Day-25 Refill Scan: Dispatches 10% OFF refill reminders when <= 5 days of medicine remain.
   * 2. 90-Day Diagnostic Re-test Scan: Dispatches home sample collection invitations when <= 10 days until re-test.
   * 3. Routine Doctor Follow-up Review Scan: Dispatches appointment scheduling invitations for cohorts due for review.
   */
  public static async runAutonomousChronicAgent(): Promise<{
    success: boolean;
    refillsNotified: number;
    retestsNotified: number;
    consultsNotified: number;
    timestamp: string;
  }> {
    try {
      // 0. Dispatch Follow-ups for dispensing/delivery rules
      await this.dispatchStrategicFollowUps();

      const cohorts = await this.getChronicCohorts();
      const today = new Date();
      const { WhatsAppTemplateEngine } = await import('./WhatsAppTemplateEngine');
      
      let refillsNotified = 0;
      let retestsNotified = 0;
      let consultsNotified = 0;

      for (const cohort of cohorts) {
        if (!cohort.patientPhone) continue;

        // 1. Refill Due Scan (<= 5 days left)
        if (cohort.nextRefillDate) {
          const refillDate = new Date(cohort.nextRefillDate);
          const diffDays = Math.ceil((refillDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 5 && diffDays >= -15) {
            const primaryMed = (cohort.medications && cohort.medications.length > 0)
              ? cohort.medications[0].name
              : (cohort.conditionName || 'Prescribed Chronic Medicine');
            const mrp = cohort.monthlyMedicineSpend || 550;
            const disc = Math.round(mrp * 0.9);

            await WhatsAppTemplateEngine.dispatchRefillReminder({
              patientPhone: cohort.patientPhone,
              patientName: cohort.patientName,
              medicineName: primaryMed,
              mrpAmount: mrp,
              discountedAmount: disc,
              clinicName: 'VitalSync Clinic',
              daysLeft: Math.max(1, diffDays)
            });
            refillsNotified++;
          }
        }

        // 2. Diagnostic Re-test Scan (<= 10 days until test)
        if (cohort.nextRetestDate) {
          const retestDate = new Date(cohort.nextRetestDate);
          const diffRetestDays = Math.ceil((retestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffRetestDays <= 10 && diffRetestDays >= -15) {
            await WhatsAppTemplateEngine.dispatchChronicRetestInvitation({
              patientPhone: cohort.patientPhone,
              patientName: cohort.patientName,
              conditionName: cohort.conditionName || 'Health Condition',
              testName: cohort.retestTestName || 'Comprehensive Chronic Biomarker Panel',
              clinicName: 'VitalSync Diagnostics'
            });
            retestsNotified++;
          }
        }

        // 3. Routine Follow-Up Consult Scan (if adherence < 80% or defaulter)
        if (cohort.status === 'defaulter_7d' || cohort.status === 'defaulter_15d' || (cohort.adherenceScore && cohort.adherenceScore < 80)) {
          await WhatsAppTemplateEngine.dispatchChronicConsultScheduling({
            patientPhone: cohort.patientPhone,
            patientName: cohort.patientName,
            doctorName: 'Dr. Pankaj Kumar',
            conditionName: cohort.conditionName || 'Chronic Care Review',
            doctorFee: 500,
            clinicName: 'VitalSync Clinic'
          });
          consultsNotified++;
        }
      }

      const result = {
        success: true,
        refillsNotified,
        retestsNotified,
        consultsNotified,
        timestamp: new Date().toISOString()
      };

      console.log('[ChronicCareService] Autonomous Chronic Agentic Engine finished sweep:', result);
      return result;
    } catch (err) {
      console.error('[ChronicCareService] Autonomous Chronic Agent error:', err);
      return {
        success: false,
        refillsNotified: 0,
        retestsNotified: 0,
        consultsNotified: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Scans local storage for strategic WhatsApp reminders (Day 7, Month 1, Month 3)
   * Enforces Rule 5 of the Clinic OS SOP.
   */
  public static async dispatchStrategicFollowUps(): Promise<void> {
    try {
      const stored = localStorage.getItem('vitalsync_strategic_reminders');
      if (!stored) return;
      
      let reminders: any[] = JSON.parse(stored);
      const today = new Date();
      let updated = false;
      const { WhatsAppTemplateEngine } = await import('./WhatsAppTemplateEngine');

      for (let i = 0; i < reminders.length; i++) {
        const reminder = reminders[i];
        if (reminder.status === 'pending') {
          const triggerDate = new Date(reminder.triggerDate);
          if (triggerDate.getTime() <= today.getTime()) {
            console.log(`[ChronicCareService] Dispatching strategic reminder (${reminder.reminderType}) to ${reminder.patientName}`);
            
            // Re-use refill reminder for now, or you could create a specific follow-up template.
            await WhatsAppTemplateEngine.dispatchRefillReminder({
              patientPhone: reminder.patientPhone,
              patientName: reminder.patientName,
              medicineName: reminder.medicineName,
              daysLeft: reminder.reminderType === '7_days' ? 23 : (reminder.reminderType === '1_month' ? 0 : 0),
              clinicName: 'VitalSync Pharmacy',
              mrpAmount: 550.00,
              discountedAmount: 495.00
            });
            
            reminder.status = 'sent';
            updated = true;
          }
        }
      }
      
      if (updated) {
        localStorage.setItem('vitalsync_strategic_reminders', JSON.stringify(reminders));
      }
    } catch (e) {
      console.error('[ChronicCareService] Failed to dispatch strategic follow-ups:', e);
    }
  }
}
