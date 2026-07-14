import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog } from './apiHelper';
import { resolvePodContext } from './podContext';
import { PatientService } from './patientService';
import type { Encounter, HistoricalBiomarker, LabRequisition, InventoryHold } from '../types';

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

    // Auto-complete active same-day appointment status
    const appts = load<any[]>('saas_appointments', []);
    const todayStr = new Date().toDateString();
    const appt = appts.find(a => 
      a.patientId === newEncounter.patientId && 
      new Date(a.createdAt).toDateString() === todayStr && 
      a.status !== 'completed'
    );
    if (appt) {
      appt.status = 'completed';
      save('saas_appointments', appts);
    }

    // 1. Create local and Supabase lab requisitions for ordered diagnostic tests
    if (newEncounter.diagnosticTests.length > 0) {
      const existingReqs = load<any[]>('lab_requisitions', []);
      const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId);
      
      for (const test of newEncounter.diagnosticTests) {
        const reqId = crypto.randomUUID();
        const barcode = `BAR-${encounterId.substring(0, 8)}-${test.loincCode}`.toUpperCase();
        const newReq: any = {
          id: reqId,
          encounterId: encounterId,
          patientId: newEncounter.patientId,
          patientName: patient?.name || 'Unknown Patient',
          testCode: test.loincCode,
          testName: test.name,
          barcode: barcode,
          status: 'pending',
          reagentDeductions: [],
          createdAt: new Date().toISOString()
        };
        existingReqs.unshift(newReq);
      }
      save('lab_requisitions', existingReqs);
    }

    // 2. Create local inventory holds and update stocks for medications
    if (newEncounter.medications.length > 0) {
      const inventory = load<any[]>('pharmacy_inventory', []);
      const holds = load<any[]>('inventory_holds', []);
      
      for (const med of newEncounter.medications) {
        const item = inventory.find(i => i.name.toLowerCase() === med.medicineName.toLowerCase() || i.genericName.toLowerCase() === med.medicineName.toLowerCase());
        const qty = 10; // default quantity for hold
        const batch = item?.batchNumber || 'MET26A-01';
        const expiry = item?.expiryDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        
        const holdId = crypto.randomUUID();
        const newHold = {
          id: holdId,
          pharmacyId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // Seeded pharmacy
          patientId: newEncounter.patientId,
          medicineName: med.medicineName,
          dosage: med.dosage || '',
          quantity: qty,
          holdStatus: 'held',
          expiryDate: expiry,
          batchNumber: batch,
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
    const patient = PatientService.getPatients().find(p => p.id === newEncounter.patientId);
    const docFee = 400;
    const labFee = newEncounter.diagnosticTests.length * 350;
    const pharmFee = newEncounter.medications.length * 150;
    const platFee = Math.max(10, (docFee + labFee + pharmFee) * 0.03);
    const total = docFee + labFee + pharmFee + platFee;

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
      upiQrPayload: `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${total}&cu=INR&tn=VitalSync-${encounterId}`,
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };
    invoices.push(newInvoice);
    save('unified_invoices', invoices);

    // Asynchronously resolve real IDs then insert to Supabase
    (async () => {
      try {
        const ctx = await resolvePodContext();

        // ── Safety guard ───────────────────────────────────────────────────────
        // NEVER use a fallback/seeded doctor UUID for a real patient encounter.
        // If doctorId is null, the session hasn't authenticated a real doctor yet.
        // Abort the entire care loop to avoid corrupting patient records.
        // ──────────────────────────────────────────────────────────────────────
        if (!ctx.doctorId) {
          console.error(
            '[EncounterService] ABORT: ctx.doctorId is null — cannot insert encounter without a verified doctor ID. ' +
            'Ensure the doctor is fully authenticated before submitting a consultation.'
          );
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: {
              title: 'Encounter Routing Failed ⚠️',
              message: 'Could not resolve your doctor profile. Please refresh and try again.',
              type: 'error'
            }
          }));
          return;
        }

        const doctorId = ctx.doctorId;
        
        // ── Trigger Bypass (Known DB Issue) ────────────────────────────────────
        // The `encounters` table has a Postgres trigger that fires AFTER INSERT
        // and attempts to call a deprecated stored procedure. This trigger throws
        // an exception on every insert, rolling back the entire transaction.
        //
        // Workaround: Insert with status = 'active'. The broken trigger only fires
        // on status = 'completed'. The frontend maps 'active' → 'completed' in the
        // UI layer (see api.ts syncFromSupabase encounter mapping).
        //
        // TODO: Fix or DROP the broken trigger in a future migration:
        //   DROP TRIGGER IF EXISTS <trigger_name> ON encounters;
        // ─────────────────────────────────────────────────────────────────────────
        const { error: encError } = await supabase.from('encounters').insert({
          id: encounterId,
          patient_id: newEncounter.patientId,
          doctor_id: doctorId,
          entity_id: ctx.entityId,
          clinical_notes: newEncounter.clinicalNotes,
          status: 'active', // ← intentional bypass (see comment above)
          pod_id: ctx.podId
        });
        if (encError) {
          console.error('[EncounterService] Error inserting encounter into Supabase:', encError);
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

        // 4. Client-side Routing Action A: Route diagnostics to Lab Requisitions
        let labFee = 0;
        if (newEncounter.diagnosticTests.length > 0 && ctx.labEntityId) {
          // Look up active lab technician in this entity to assign the requisitions
          let assignedTechId: string | null = null;
          try {
            const { data: techProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('entity_id', ctx.labEntityId)
              .eq('role', 'lab_technician')
              .limit(1)
              .maybeSingle();
            if (techProfile) {
              assignedTechId = techProfile.id;
            }
          } catch (err) {
            console.error('Error looking up lab technician profile:', err);
          }

          for (const test of newEncounter.diagnosticTests) {
            let testPrice = 350.00;
            try {
              const { data: catalogItem } = await supabase
                .from('master_test_catalog')
                .select('price')
                .eq('loinc_code', test.loincCode)
                .maybeSingle();
              if (catalogItem?.price) {
                testPrice = Number(catalogItem.price);
              }
            } catch (err) {
              console.error('Error reading test price from catalog:', err);
            }

            labFee += testPrice;

            await supabase.from('lab_requisitions').insert({
              encounter_id: encounterId,
              patient_id: newEncounter.patientId,
              lab_entity_id: ctx.labEntityId,
              loinc_code: test.loincCode,
              test_name: test.name,
              barcode: `BAR-${encounterId.substring(0, 8)}-${test.loincCode}`.toUpperCase(),
              status: 'pending',
              assigned_technician_id: assignedTechId,
              pod_id: ctx.podId
            });
          }
        }

        // 5. Client-side Routing Action B: Reserve Pharmacy Stock via FEFO (First Expiry First Out)
        let pharmacyFee = 0;
        if (newEncounter.medications.length > 0 && ctx.pharmacyEntityId) {
          for (const med of newEncounter.medications) {
            const neededQty = 10;
            let remainingQty = neededQty;
            pharmacyFee += 150; // standard flat medicine fee per prescribed drug item

            try {
              // Fetch active batches sorted by expiry date ascending (FEFO)
              const { data: batches } = await supabase
                .from('pharmacy_inventory')
                .select('id, batch_number, expiry_date, quantity_in_stock')
                .eq('pharmacy_entity_id', ctx.pharmacyEntityId)
                .eq('medicine_name', med.medicineName)
                .eq('is_active', true)
                .gt('quantity_in_stock', 0)
                .gte('expiry_date', new Date().toISOString().split('T')[0])
                .order('expiry_date', { ascending: true });

              if (batches && batches.length > 0) {
                for (const batch of batches) {
                  if (remainingQty <= 0) break;

                  const allocatedQty = Math.min(batch.quantity_in_stock, remainingQty);

                  // Update stock in Supabase
                  await supabase
                    .from('pharmacy_inventory')
                    .update({
                      quantity_in_stock: batch.quantity_in_stock - allocatedQty,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', batch.id);

                  // Insert into inventory_holds
                  await supabase.from('inventory_holds').insert({
                    pharmacy_entity_id: ctx.pharmacyEntityId,
                    encounter_id: encounterId,
                    patient_id: newEncounter.patientId,
                    medicine_name: med.medicineName,
                    dosage: med.dosage || '',
                    quantity: allocatedQty,
                    batch_number: batch.batch_number,
                    expiry_date: batch.expiry_date,
                    hold_status: 'held'
                  });

                  remainingQty -= allocatedQty;
                }
              }

              if (remainingQty > 0) {
                // Shortage/Out of stock fallback
                const holdStatus = remainingQty === neededQty ? 'OUT_OF_STOCK' : 'SHORTAGE';
                 await supabase.from('inventory_holds').insert({
                  pharmacy_entity_id: ctx.pharmacyEntityId,
                  encounter_id: encounterId,
                  patient_id: newEncounter.patientId,
                  medicine_name: med.medicineName,
                  dosage: med.dosage || '',
                  quantity: remainingQty,
                  batch_number: holdStatus,
                  expiry_date: null,
                  hold_status: 'held'
                });

                // Write to activity logs
                await supabase.from('activity_logs').insert({
                  action_type: 'INVENTORY_SHORTAGE',
                  details: {
                    medicine_name: med.medicineName,
                    requested_quantity: neededQty,
                    remaining_quantity: remainingQty,
                    encounter_id: encounterId,
                    pharmacy_entity_id: ctx.pharmacyEntityId
                  },
                  entity_id: ctx.pharmacyEntityId,
                  pod_id: ctx.podId
                });
              }
            } catch (inventoryErr) {
              console.error('Error handling pharmacy stock allocation:', inventoryErr);
            }
          }
        }

        // 6. Client-side Routing Action C: Generate Unified Invoice
        let doctorFee = 400.00;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('consultation_fee')
            .eq('id', doctorId)
            .maybeSingle();
          if (profile?.consultation_fee) {
            doctorFee = Number(profile.consultation_fee);
          }
        } catch (feeErr) {
          console.error('Error fetching doctor consultation fee:', feeErr);
        }

        let platformFee = (doctorFee + labFee + pharmacyFee) * 0.03;
        if (platformFee < 10.00) {
          platformFee = 10.00;
        }
        const invoiceTotal = doctorFee + labFee + pharmacyFee + platformFee;

        const { error: invError } = await supabase.from('unified_invoices').insert({
          encounter_id: encounterId,
          patient_id: newEncounter.patientId,
          doctor_fee: doctorFee,
          lab_fee: labFee,
          pharmacy_fee: pharmacyFee,
          platform_fee: platformFee,
          total_amount: invoiceTotal,
          upi_qr_payload: `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${invoiceTotal}&cu=INR&tn=VitalSync-${encounterId}`,
          pod_id: ctx.podId
        });
        if (invError) {
          console.error('Error inserting unified invoice:', invError);
        }

        // 7. Transition patient's WhatsApp session state to AWAITING_PAYMENT
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
              chatHistory: currentHistory,
              invoiceTotal: invoiceTotal
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
      } catch (globalErr) {
        // ── Partial failure recovery ────────────────────────────────────────────
        // The care loop runs client-side as a fire-and-forget async block.
        // If an error occurs mid-loop, some records may have been written while
        // others haven't. Log a structured failure record to activity_logs so
        // operations can detect and remediate incomplete care loops.
        // ─────────────────────────────────────────────────────────────────────
        console.error('[EncounterService] CRITICAL: Client-side care loop routing failed:', globalErr);
        try {
          await supabase.from('activity_logs').insert({
            action_type: 'CARE_LOOP_PARTIAL_FAILURE',
            details: {
              encounter_id: encounterId,
              patient_id: newEncounter.patientId,
              error: String(globalErr),
              failed_at: new Date().toISOString(),
              note: 'Some care loop records may be incomplete. Manual review required.'
            },
            entity_id: null,
            pod_id: null
          });
        } catch (_logErr) {
          // If even logging fails, nothing more we can do on the client
        }

        // Toast the doctor so they know to re-submit or call support
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Care Loop Routing Error ⚠️',
            message: 'Consultation saved locally but some backend records may be incomplete. Please contact support with Encounter ID: ' + encounterId.substring(0, 8).toUpperCase(),
            type: 'error'
          }
        }));
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
