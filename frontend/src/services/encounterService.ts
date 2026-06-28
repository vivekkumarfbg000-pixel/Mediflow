import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog } from './apiHelper';
import { resolvePodContext, FALLBACK_DOCTOR_ID } from './podContext';
import { PatientService } from './patientService';
import type { Encounter, HistoricalBiomarker, LabRequisition } from '../types';

export class EncounterService {
  static getEncounters(): Encounter[] {
    return load<Encounter[]>('encounters', []);
  }

  static createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const encounters = this.getEncounters();
    const encounterId = crypto.randomUUID();
    const newEncounter: Encounter = {
      ...encounterData,
      id: encounterId,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    encounters.push(newEncounter);
    save('encounters', encounters);

    // Transition patient's local and database queue status to completed
    PatientService.updatePatientQueueStatus(newEncounter.patientId, 'completed');

    // Asynchronously resolve real IDs then insert to Supabase
    (async () => {
      const ctx = await resolvePodContext();
      const doctorId = ctx.doctorId || FALLBACK_DOCTOR_ID;
      const { error } = await supabase.from('encounters').insert({
        id: encounterId,
        patient_id: newEncounter.patientId,
        doctor_id: doctorId,
        entity_id: ctx.entityId,
        clinical_notes: newEncounter.clinicalNotes,
        status: 'active'
      });
      if (error) {
        console.error('Error inserting encounter into Supabase:', error);
        return;
      }
      writeAuditLog('encounter_created', { patientId: newEncounter.patientId }, encounterId);

      // 2. Insert e-prescription medicines
      if (newEncounter.medications.length > 0) {
        const medsPayload = newEncounter.medications.map(med => ({
          encounter_id: encounterId,
          medicine_name: med.medicineName,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration
        }));
        await supabase.from('encounter_medications').insert(medsPayload);
      }

      // 3. Insert ordered diagnostics tests
      if (newEncounter.diagnosticTests.length > 0) {
        const diagsPayload = newEncounter.diagnosticTests.map(test => ({
          encounter_id: encounterId,
          loinc_code: test.loincCode,
          test_name: test.name,
          status: 'ordered'
        }));
        await supabase.from('encounter_diagnostics').insert(diagsPayload);
      }

      // 4. Update the encounter status to 'completed'
      const { error: updateError } = await supabase
        .from('encounters')
        .update({ status: 'completed' })
        .eq('id', encounterId);

      if (updateError) {
        console.error('Error completing encounter in Supabase:', updateError);
        return;
      }

      // 5. Transition patient's WhatsApp session state to AWAITING_PAYMENT
      const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId);
      if (patient) {
        const sessions = load<any[]>('whatsapp_sessions', []);
        const existing = sessions.find(s => s.patientPhone === patient.phone);
        if (existing) {
          existing.currentState = 'AWAITING_PAYMENT';
          existing.lastInteraction = new Date().toISOString();
          const currentHistory = existing.sessionData.chatHistory || [];
          currentHistory.push({
            sender: 'bot',
            text: `*Dr. Sharma* has signed off your Clinical e-Prescription (e-Rx) and care invoice.\n\n*Generic Medicines ordered*:\n${newEncounter.medications.map(m => `💊 ${m.medicineName} (${m.frequency}, ${m.duration})`).join('\n')}\n\n*Diagnostics Ordered*:\n${newEncounter.diagnosticTests.map(t => `🧪 ${t.name}`).join('\n')}\n\n*Payment Pending*: A unified care pod invoice is generated. Please pay below:`,
            time: new Date().toISOString()
          });
          existing.sessionData = {
            ...existing.sessionData,
            chatHistory: currentHistory
          };
          save('whatsapp_sessions', sessions);
          
          await supabase.from('whatsapp_sessions').update({
            current_state: 'AWAITING_PAYMENT',
            session_data: existing.sessionData,
            last_interaction: new Date().toISOString()
          }).eq('patient_phone', patient.phone);
          
          await writeAuditLog('WHATSAPP_STATE_TRANSITION', { phone: patient.phone, newState: 'AWAITING_PAYMENT' }, existing.id);
        }
      }
    });

    return newEncounter;
  }

  static getPatientHistoricalBiomarkers(patientId: string): HistoricalBiomarker[] {
    const requisitions = load<LabRequisition[]>('lab_requisitions', []).filter(
      r => r.patientId === patientId && r.status === 'completed' && r.quantitativeResult
    );

    const dateMap = new Map<string, { HbA1c?: number; creatinine?: number; hemoglobin?: number }>();

    const baseline = [
      { date: '2026-03-10', HbA1c: 7.8, creatinine: 0.9, hemoglobin: 13.5, temperature: '6/6', bloodPressure: '6/6', pulseRate: 15 },
      { date: '2026-04-15', HbA1c: 7.4, creatinine: 1.1, hemoglobin: 13.1, temperature: '6/6', bloodPressure: '6/9', pulseRate: 18 }
    ];

    const historyList: HistoricalBiomarker[] = [];
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

    const patientObj = PatientService.getPatients().find(p => p.id === patientId);
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
}
