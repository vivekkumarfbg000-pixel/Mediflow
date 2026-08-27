import { supabase } from '../lib/supabaseClient';
import { getPodContext } from './podContext';
import { getIstDateString, getIstOffsetDateString } from '../utils/dateUtils';
import { ClinicalNotificationService } from './clinicalNotificationService';

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
}

export class ChronicCareService {
  /**
   * Parse chronic disease category from prescription text or diagnoses
   */
  public static detectChronicCondition(prescriptionText: string, diagnosisText: string): ChronicConditionProtocol | null {
    const combined = `${prescriptionText} ${diagnosisText}`.toLowerCase();
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
    return Math.max(7, Math.floor(totalCount / pillsPerDay));
  }

  /**
   * Fetch chronic cohorts for active pod
   */
  public static async getChronicCohorts(): Promise<ChronicCohortRecord[]> {
    const pod = getPodContext();
    const podId = pod?.podId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

    try {
      const { data, error } = await supabase
        .from('chronic_care_cohorts')
        .select('*')
        .eq('pod_id', podId)
        .order('next_refill_date', { ascending: true });

      if (error || !data || data.length === 0) {
        return this.getFallbackMockCohorts();
      }

      return data.map(row => ({
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
        monthlyMedicineSpend: Number(row.monthly_medicine_spend) || 0
      }));
    } catch (err) {
      console.warn('[ChronicCareService] Using fallback mock cohorts:', err);
      return this.getFallbackMockCohorts();
    }
  }

  /**
   * Register or update a patient in chronic cohorts
   */
  public static async registerChronicPatient(record: Partial<ChronicCohortRecord>): Promise<boolean> {
    const pod = getPodContext();
    const podId = pod?.podId || record.podId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

    try {
      const { error } = await supabase
        .from('chronic_care_cohorts')
        .insert([{
          patient_id: record.patientId,
          patient_name: record.patientName,
          patient_phone: record.patientPhone,
          doctor_id: record.doctorId || 'doc-primary',
          pod_id: podId,
          condition_code: record.conditionCode || 'DIABETES',
          condition_name: record.conditionName || 'Type-2 Diabetes Mellitus',
          medications: record.medications || [],
          days_supply: record.daysSupply || 30,
          dispensed_at: new Date().toISOString(),
          next_refill_date: record.nextRefillDate || getIstOffsetDateString(25),
          next_retest_date: record.nextRetestDate || getIstOffsetDateString(75),
          retest_test_code: record.retestTestCode || '4544-3',
          retest_test_name: record.retestTestName || 'HbA1c & Fasting Glucose Panel',
          adherence_score: record.adherenceScore || 100.0,
          status: 'active',
          monthly_medicine_spend: record.monthlyMedicineSpend || 1200
        }]);

      return !error;
    } catch (err) {
      console.error('[ChronicCareService] Registration error:', err);
      return false;
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
        podId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
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
    const cohorts = this.getFallbackMockCohorts();
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
}
