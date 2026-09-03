import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog } from './apiHelper';
import { getPodContext, resolvePodContext, DEMO_PATIENT_ID_1 } from './podContext';
import { PatientService } from './patientService';
import { PaymentService } from './paymentService';
import { BillingService } from './billingService';
import { MASTER_TEST_CATALOG } from './labService';
import { getIstDateString, getEffectiveAppointmentDate } from '../utils/dateUtils';
import { safeGetStorageJSON } from '../utils/storage';
import type { Encounter, HistoricalBiomarker, LabRequisition, InventoryHold } from '../types';

export class EncounterService {
  static getEncounters(): Encounter[] {
    const rawEncounters = load<Encounter[]>('encounters', []);
    const saasPrescriptions = load<any[]>('saas_prescriptions', []);
    const prescriptions = load<any[]>('prescriptions', []);

    // Build unified map of encounters
    const encMap = new Map<string, Encounter>();

    rawEncounters.forEach(enc => {
      encMap.set(enc.id, { ...enc });
    });

    // Synthesize from saas_prescriptions if not in rawEncounters
    saasPrescriptions.forEach(rx => {
      const encId = rx.encounterId || rx.encounter_id || rx.id;
      if (!encMap.has(encId)) {
        encMap.set(encId, {
          id: encId,
          patientId: rx.patientId || rx.patient_id,
          patientName: rx.patientName || rx.patient_name || 'Patient',
          patientPhone: rx.patientPhone || rx.patient_phone || '',
          doctorId: rx.doctorId || rx.doctor_id || getPodContext().doctorId || null,
          clinicalNotes: rx.notes || rx.clinical_notes || rx.clinicalNotes || '',
          medications: rx.extractedMedicines || rx.extracted_medicines || rx.medications || [],
          diagnosticTests: (rx.extractedTests || rx.extracted_tests || []).map((t: any) => typeof t === 'string' ? { name: t, loincCode: t } : t),
          status: rx.status || 'completed',
          createdAt: rx.createdAt || rx.created_at || new Date().toISOString()
        });
      }
    });

    // Synthesize from legacy prescriptions if not present
    prescriptions.forEach(rx => {
      const encId = rx.encounterId || rx.encounter_id || rx.id;
      if (!encMap.has(encId)) {
        encMap.set(encId, {
          id: encId,
          patientId: rx.patientId || rx.patient_id,
          patientName: rx.patientName || rx.patient_name || 'Patient',
          patientPhone: rx.patientPhone || rx.patient_phone || '',
          doctorId: rx.doctorId || rx.doctor_id || getPodContext().doctorId || null,
          clinicalNotes: rx.notes || rx.clinical_notes || '',
          medications: rx.medications || rx.medicines || [],
          diagnosticTests: (rx.diagnosticTests || rx.diagnostic_tests || []).map((t: any) => typeof t === 'string' ? { name: t, loincCode: t } : t),
          status: rx.status || 'completed',
          createdAt: rx.createdAt || rx.created_at || new Date().toISOString()
        });
      }
    });

    // Merge and normalize medications and diagnostic tests from saas_prescriptions if empty
    return Array.from(encMap.values()).map(enc => {
      const pId = enc.patientId || (enc as any).patient_id;
      let meds = enc.medications || [];
      if (!meds || meds.length === 0) {
        const matchSaas = saasPrescriptions.find(p => (p.encounterId === enc.id || p.encounter_id === enc.id) || (pId && (p.patientId === pId || p.patient_id === pId) && (p.createdAt || p.created_at)?.slice(0, 10) === (enc.createdAt || '').slice(0, 10)));
        if (matchSaas) {
          meds = matchSaas.extractedMedicines || matchSaas.extracted_medicines || matchSaas.medications || [];
        } else {
          const matchRx = prescriptions.find(p => (p.encounterId === enc.id || p.encounter_id === enc.id) || (pId && (p.patientId === pId || p.patient_id === pId) && (p.createdAt || p.created_at)?.slice(0, 10) === (enc.createdAt || '').slice(0, 10)));
          if (matchRx) {
            meds = matchRx.medications || matchRx.medicines || [];
          }
        }
      }

      // Ensure each medication has medicineName
      const normalizedMeds = (meds || []).map((m: any, idx: number) => ({
        id: m.id || `med-${idx}`,
        medicineName: m.medicineName || m.name || 'Medicine',
        name: m.medicineName || m.name || 'Medicine',
        dosage: m.dosage || '1-0-1',
        frequency: m.frequency || 'twice daily',
        duration: m.duration || '5 Days',
        instructions: m.instructions || ''
      }));

      let tests = enc.diagnosticTests || [];
      if (!tests || tests.length === 0) {
        const matchSaas = saasPrescriptions.find(p => (p.encounterId === enc.id || p.encounter_id === enc.id) || (pId && (p.patientId === pId || p.patient_id === pId) && (p.createdAt || p.created_at)?.slice(0, 10) === (enc.createdAt || '').slice(0, 10)));
        if (matchSaas) {
          tests = (matchSaas.extractedTests || matchSaas.extracted_tests || []).map((t: any) => typeof t === 'string' ? { name: t, loincCode: t } : t);
        } else {
          const matchRx = prescriptions.find(p => (p.encounterId === enc.id || p.encounter_id === enc.id) || (pId && (p.patientId === pId || p.patient_id === pId) && (p.createdAt || p.created_at)?.slice(0, 10) === (enc.createdAt || '').slice(0, 10)));
          if (matchRx) {
            tests = (matchRx.diagnosticTests || matchRx.diagnostic_tests || []).map((t: any) => typeof t === 'string' ? { name: t, loincCode: t } : t);
          }
        }
      }

      return {
        ...enc,
        patientId: pId,
        patient_id: pId,
        medications: normalizedMeds,
        diagnosticTests: tests
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  static createEncounter(encounterData: Omit<Encounter, 'id' | 'createdAt' | 'status'>): Encounter {
    const encounters = load<Encounter[]>('encounters', []);
    const encounterId = crypto.randomUUID();
    const ctx = getPodContext();
    const patientObj = PatientService.getPatients().find(p => p.id === encounterData.patientId || (p as any).patient_code === encounterData.patientId);
    
    const newEncounter: Encounter = {
      ...encounterData,
      id: encounterId,
      patientPhone: encounterData.patientPhone || patientObj?.phone || '',
      patientName: encounterData.patientName || patientObj?.name || 'Patient',
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    encounters.unshift(newEncounter);
    save('encounters', encounters);

    // Also persist into local saas_prescriptions for instant cross-console availability
    const saasPrescriptions = load<any[]>('saas_prescriptions', []);
    const newRxRecord = {
      id: crypto.randomUUID(),
      encounterId: encounterId,
      encounter_id: encounterId,
      patientId: newEncounter.patientId,
      patient_id: newEncounter.patientId,
      patientName: newEncounter.patientName,
      patient_name: newEncounter.patientName,
      patientPhone: newEncounter.patientPhone,
      patient_phone: newEncounter.patientPhone,
      doctorId: newEncounter.doctorId || ctx.doctorId || null,
      doctor_id: newEncounter.doctorId || ctx.doctorId || null,
      extractedMedicines: newEncounter.medications || [],
      extracted_medicines: newEncounter.medications || [],
      extractedTests: (newEncounter.diagnosticTests || []).map(t => t.loincCode || t.name),
      extracted_tests: (newEncounter.diagnosticTests || []).map(t => t.loincCode || t.name),
      clinicalNotes: newEncounter.clinicalNotes,
      clinical_notes: newEncounter.clinicalNotes,
      status: 'active',
      podId: ctx.podId,
      pod_id: ctx.podId,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    saasPrescriptions.unshift(newRxRecord);
    save('saas_prescriptions', saasPrescriptions);

    // Transition patient's local and database queue status to completed
    PatientService.updatePatientQueueStatus(newEncounter.patientId, 'completed');

    // Auto-complete active same-day / advance appointment status
    const appts = load<any[]>('saas_appointments', []);
    const todayISO = getIstDateString();

    const appt = appts.find(a => {
      const isMatchingPatient = a.patientId === newEncounter.patientId || (a as any).patient_id === newEncounter.patientId;
      if (!isMatchingPatient) return false;
      if (a.status === 'completed') return false;
      return getEffectiveAppointmentDate(a) === todayISO;
    });
    if (appt) {
      appt.status = 'completed';
      save('saas_appointments', appts);
      Promise.resolve(supabase.from('appointments').update({ status: 'completed' }).eq('id', appt.id))
        .then((res: any) => { if (res?.error) console.error('[Mediflow] appointments update error:', res.error); })
        .catch((err: any) => console.error('[Mediflow] appointments background update caught:', err));
    }

    // 1. Create local and Supabase lab requisitions for ordered diagnostic tests
    if ((newEncounter.diagnosticTests || []).length > 0) {
      const existingReqs = load<any[]>('lab_requisitions', []);
      const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId || (p as any).patient_code === newEncounter.patientId);
      const dbReqsToInsert: any[] = [];
      const resolvedPatientName = patient?.name || newEncounter.patientName || 'Patient';
      
      for (const test of newEncounter.diagnosticTests) {
        const reqId = crypto.randomUUID();
        const barcode = `BAR-${encounterId.substring(0, 8)}-${test.loincCode}`.toUpperCase();
        const newReq: any = {
          id: reqId,
          encounterId: encounterId,
          patientId: newEncounter.patientId,
          patientName: resolvedPatientName,
          patientPhone: patient?.phone || newEncounter.patientPhone || '',
          testCode: test.loincCode,
          testName: test.name,
          barcode: barcode,
          status: 'pending',
          podId: ctx.podId,
          pod_id: ctx.podId,
          reagentDeductions: [],
          createdAt: new Date().toISOString()
        };
        existingReqs.unshift(newReq);
        dbReqsToInsert.push({
          id: reqId,
          encounter_id: encounterId,
          patient_id: newEncounter.patientId,
          test_code: test.loincCode,
          test_name: test.name,
          barcode: barcode,
          status: 'pending',
          pod_id: ctx.podId,
          lab_entity_id: ctx.labEntityId || null,
          created_at: new Date().toISOString()
        });
      }
      save('lab_requisitions', existingReqs);
      if (dbReqsToInsert.length > 0) {
        Promise.resolve(supabase.from('lab_requisitions').upsert(dbReqsToInsert, { onConflict: 'id' }))
          .then((res: any) => { if (res?.error) console.error('[Mediflow] lab_requisitions upsert error:', res.error); })
          .catch((err: any) => console.error('[Mediflow] lab_requisitions background upsert caught:', err));
      }
    }

    // 2. Create local inventory holds and update stocks for medications
    if ((newEncounter.medications || []).length > 0) {
      const inventory = load<any[]>('pharmacy_inventory', []);
      const holds = load<any[]>('inventory_holds', []);
      const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId || (p as any).patient_code === newEncounter.patientId);
      const resolvedPatientName = patient?.name || newEncounter.patientName || 'Patient';
      const resolvedPatientPhone = patient?.phone || newEncounter.patientPhone || '';
      
      for (const med of newEncounter.medications) {
        const item = inventory.find(i => (i.name || '').toLowerCase() === (med.medicineName || '').toLowerCase() || (i.genericName || '').toLowerCase() === (med.medicineName || '').toLowerCase());
        // BUG-10 FIX: Calculate hold quantity from prescription dosage instead of hardcoded 10
        const dosageStr = (med.dosage || '1-0-0').trim();
        const doseParts = dosageStr.match(/(\d+)/g);
        const dosePerDay = doseParts ? doseParts.reduce((sum: number, d: string) => sum + (parseInt(d, 10) || 0), 0) : 1;
        const durationStr = (med.duration || '').trim();
        const durationMatch = durationStr.match(/(\d+)/); 
        const durationDays = durationMatch ? parseInt(durationMatch[1], 10) : 7; // default 7 days if unspecified
        const qty = Math.max(1, dosePerDay * durationDays);
        // BUG-11 FIX: Use actual batch from inventory; null if not found (no fake batch)
        const batch = item?.batchNumber || null;
        const expiry = item?.expiryDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
        
        const holdId = crypto.randomUUID();
        const newHold = {
          id: holdId,
          pharmacyId: ctx.pharmacyEntityId || null,
          patientId: newEncounter.patientId,
          patientName: resolvedPatientName,
          patientPhone: resolvedPatientPhone,
          medicineName: med.medicineName,
          dosage: med.dosage || '',
          quantity: qty,
          holdStatus: item ? 'held' : 'out_of_stock',
          expiryDate: expiry,
          batchNumber: batch,
          podId: ctx.podId,
          pod_id: ctx.podId,
          createdAt: new Date().toISOString()
        };
        holds.push(newHold);
        
        if (item) {
          item.stock = Math.max(0, item.stock - qty);
        }
      }
      save('inventory_holds', holds);
      save('pharmacy_inventory', inventory);
    }

    // 3. Create local unified invoice
    const invoices = load<any[]>('unified_invoices', []);
    const saasInvoices = load<any[]>('saas_invoices', []);
    const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId);

    // Check if consultation fee was ALREADY paid at Gate 1 booking time
    const alreadyPaidConsult = saasInvoices.some((i: any) => i.patientId === newEncounter.patientId && i.type === 'consult' && i.status === 'paid') ||
                               invoices.some((i: any) => (i.patientId === newEncounter.patientId || i.patient_id === newEncounter.patientId) && (i.paymentStatus === 'cleared' || i.payment_status === 'cleared') && ((i.doctorFee || i.doctor_fee || 0) > 0 || i.type === 'consult'));

    // BUG-05 FIX: Read doctor fee from active SOP config instead of hardcoded ₹400
    const activeSop = BillingService.getActiveSop();
    const sopDoctorFee = activeSop?.extractedConfig?.doctor_fee ?? 500;
    const docFee = alreadyPaidConsult ? 0 : sopDoctorFee;

    // BUG-06 FIX: Look up actual lab test prices from MASTER_TEST_CATALOG
    let labFee = 0;
    for (const test of (newEncounter.diagnosticTests || [])) {
      const catalogEntry = MASTER_TEST_CATALOG.find(t => t.loincCode === test.loincCode || (t.name || '').toLowerCase() === (test.name || '').toLowerCase());
      labFee += (catalogEntry as any)?.price || 350; // fallback 350 only if test not in catalog
    }

    // BUG-06 FIX: Look up actual pharmacy prices from inventory
    const inventoryForPricing = load<any[]>('pharmacy_inventory', []);
    let pharmFee = 0;
    for (const med of (newEncounter.medications || [])) {
      const invItem = inventoryForPricing.find((i: any) => (i.name || '').toLowerCase() === (med.medicineName || '').toLowerCase() || (i.genericName || '').toLowerCase() === (med.medicineName || '').toLowerCase());
      pharmFee += (invItem?.mrp || invItem?.price || 150); // fallback 150 only if not in inventory
    }

    // BUG-07 FIX: Counter Doctor Consultation Fee Immunity Protocol (Rule 58/103)
    const isPureCounterConsult = (pharmFee === 0) && (labFee === 0);
    const platFee = isPureCounterConsult ? 0 : parseFloat(((docFee + labFee + pharmFee) * 0.03).toFixed(2));
    const total = docFee + labFee + pharmFee + platFee;

    const dynamicUpiPayload = PaymentService.generateDirectUpiPayload(total, encounterId).upiDeepLink;

    const newInvoice = {
      id: crypto.randomUUID(),
      encounterId: encounterId,
      patientId: newEncounter.patientId,
      patientName: patient?.name || 'Unknown Patient',
      patientPhone: patient?.phone || '',
      doctorFee: docFee,
      labFee: labFee,
      pharmacyFee: pharmFee,
      platformFee: platFee,
      totalAmount: total,
      upiQrPayload: dynamicUpiPayload,
      paymentStatus: (docFee === 0 && labFee === 0 && pharmFee === 0) ? 'cleared' : 'pending',
      createdAt: new Date().toISOString()
    };
    invoices.push(newInvoice);
    save('unified_invoices', invoices);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { entity: 'encounter', encounterId } }));
    }

    // Asynchronously resolve real IDs then insert to Supabase
    (async () => {
      try {
        const ctx = await resolvePodContext();
        // BUG-34 FIX: Resolve dynamically, never fallback to hardcoded demo doctor
        const doctorId = newEncounter.doctorId || ctx.doctorId || null;
        
        // 1. Insert/Upsert into public.encounters with complete medications and tests
        const { error: encError } = await supabase.from('encounters').upsert({
          id: encounterId,
          patient_id: newEncounter.patientId,
          doctor_id: doctorId,
          entity_id: ctx.entityId,
          clinical_notes: newEncounter.clinicalNotes,
          medications: newEncounter.medications || [],
          diagnostic_tests: newEncounter.diagnosticTests || [],
          status: 'completed',
          pod_id: ctx.podId
        }, { onConflict: 'id' });
        if (encError) {
          console.error('[EncounterService] Error inserting encounter into Supabase:', encError);
        }
        writeAuditLog('CLINICAL_ENCOUNTER_COMPLETED', {
          encounterId,
          patientName: newEncounter.patientName,
          medicinesCount: (newEncounter.medications || []).length,
          testsCount: (newEncounter.diagnosticTests || []).length,
          doctorId
        }, newEncounter.patientId);

        // 2. Insert/Upsert into public.saas_prescriptions for 360-degree platform sync
        try {
          await supabase.from('saas_prescriptions').upsert({
            id: newRxRecord.id,
            encounter_id: encounterId,
            patient_id: newEncounter.patientId,
            doctor_id: doctorId,
            extracted_medicines: newEncounter.medications || [],
            extracted_tests: (newEncounter.diagnosticTests || []).map(t => t.loincCode || t.name),
            status: 'active',
            pod_id: ctx.podId
          }, { onConflict: 'id' });
        } catch (rxErr) {
          console.warn('[EncounterService] saas_prescriptions upsert notice:', rxErr);
        }

        // 3. Insert/Upsert into public.inventory_holds for pharmacy POS realtime sync
        try {
          if ((newEncounter.medications || []).length > 0) {
            const currentHolds = load<any[]>('inventory_holds', []).filter(h => h.encounterId === encounterId);
            const dbHolds = currentHolds.map(h => ({
              id: h.id,
              encounter_id: encounterId,
              patient_id: newEncounter.patientId,
              medicine_name: h.medicineName,
              quantity: h.quantity,
              unit: h.unit || 'tablets',
              expiry_date: h.expiryDate || null,
              batch_number: h.batchNumber || null,
              status: 'reserved',
              pod_id: ctx.podId,
              created_at: h.createdAt || new Date().toISOString()
            }));
            if (dbHolds.length > 0) {
              await supabase.from('inventory_holds').upsert(dbHolds, { onConflict: 'id' });
            }
          }
        } catch (holdErr) {
          console.warn('[EncounterService] inventory_holds upsert notice:', holdErr);
        }

        // 4. Directly update patient_registry.queue_status in Supabase
        try {
          await supabase.from('patient_registry')
            .update({ queue_status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', newEncounter.patientId);
        } catch (pErr) {
          console.warn('[EncounterService] patient_registry queue_status update notice:', pErr);
        }

        // 4. Atomic Care Loop RPC
        const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId);
        
        const { error: rpcError, data: rpcResult } = await supabase.rpc('process_clinical_care_loop', {
          p_encounter_id: encounterId,
          p_patient_id: newEncounter.patientId,
          p_doctor_id: doctorId,
          p_pod_id: ctx.podId,
          p_lab_entity_id: ctx.labEntityId,
          p_pharmacy_entity_id: ctx.pharmacyEntityId,
          p_medications: newEncounter.medications || [],
          p_diagnostics: newEncounter.diagnosticTests || [],
          p_patient_phone: patient?.phone || null
        });

        if (rpcError || (rpcResult && rpcResult.success === false)) {
          console.warn('[EncounterService] Care loop RPC fallback notice:', rpcError || rpcResult?.error);
        }

        // 5. 🌟 ENTERPRISE DUAL-WRITE: Instantly persist unified consultation invoice to Supabase
        try {
          await supabase.from('unified_invoices').upsert({
            id: newInvoice.id,
            encounter_id: encounterId,
            patient_id: newEncounter.patientId,
            doctor_fee: docFee,
            lab_fee: labFee,
            pharmacy_fee: pharmFee,
            platform_fee: platFee,
            total_amount: total,
            upi_qr_payload: dynamicUpiPayload,
            payment_status: newInvoice.paymentStatus,
            payment_method: 'upi',
            created_at: newInvoice.createdAt,
            pod_id: ctx.podId
          }, { onConflict: 'id' });
        } catch (invErr) {
          console.warn('[EncounterService] unified_invoices remote dual-write notice:', invErr);
        }
      } catch (globalErr) {
        console.error('[EncounterService] Background care loop sync caught:', globalErr);
      }
    })();

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
    const cachedProfile = safeGetStorageJSON<any>('vitalsync_cached_profile', null);
    const isDemo = typeof window !== 'undefined' && (localStorage.getItem('mediflow_dev_bypass') === 'true' || Boolean(cachedProfile?.isDemo));
    if (isDemo && (patientId === DEMO_PATIENT_ID_1 || patientId === 'p-1')) {
      historyList.push(...baseline.map(b => ({ ...b })));
    }

    requisitions.forEach(r => {
      try {
        const payload = JSON.parse(r.quantitativeResult || '{}');
        const bio = payload.biomarkers || {};
        const dateStr = (r.createdAt || new Date().toISOString()).split('T')[0];

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
}
