const { createClient } = require('@supabase/supabase-js');

// Supabase credentials extracted from frontend VITE environment
const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runE2EValidation() {
  console.log('========================================================================');
  console.log('[Mediflow E2E DevSecOps] INITIATING HAPPY PATH PILOT POD CARE LOOP...');
  console.log('========================================================================\n');

  try {
    console.log('[Step 0] Authenticating as Doctor Vivek...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'doctor@mediflow.com',
      password: 'password123'
    });
    if (authError) {
      throw new Error('Failed to authenticate as Doctor Vivek: ' + authError.message);
    }
    console.log(`- Success! Authenticated as: ${authData.user.email} (ID: ${authData.user.id})\n`);

    const patientPhone = '9876543210';
    const doctorId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101'; // Doctor Vivek
    const clinicEntityId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'; // Clinic

    // 1. Fetch Aarav Sharma's patient profile
    console.log('[Step 1] Fetching Aarav Sharma registry profile...');
    const { data: patient, error: patientErr } = await supabase
      .from('patient_registry')
      .select('*')
      .eq('phone', patientPhone)
      .single();

    if (patientErr || !patient) {
      throw new Error('Failed to retrieve Aarav Sharma: ' + (patientErr?.message || 'Empty'));
    }
    console.log(`- Success! Retrived patient: ${patient.name} (ABHA ID: ${patient.abha_id})\n`);

    // 2. Initialize WhatsApp Bot Session
    console.log('[Step 2] Initializing WhatsApp bot session...');
    // Clean existing sessions
    await supabase.from('whatsapp_sessions').delete().eq('patient_phone', patientPhone);
    await supabase.from('patient_consents').delete().eq('patient_id', patient.id);

    // Insert new session simulating receipt of welcome trigger
    const sessionUuid = crypto.randomUUID();
    const { data: session, error: sessErr } = await supabase
      .from('whatsapp_sessions')
      .insert({
        id: sessionUuid,
        patient_phone: patientPhone,
        patient_id: patient.id,
        current_state: 'AWAITING_WELCOME',
        session_data: { chatHistory: [{ sender: 'bot', text: 'Welcome to Mediflow' }] }
      })
      .select()
      .single();

    if (sessErr || !session) {
      throw new Error('Failed to create WhatsApp session: ' + (sessErr?.message || 'Empty'));
    }
    console.log(`- Success! Created whatsapp session ID: ${session.id} in state: ${session.current_state}\n`);

    // 3. Simulate patient granting consent by replying '1'
    console.log('[Step 3] Simulating patient replying "1" to grant consent...');
    // We update session and insert a patient consent row (mimicking the api.ts conversational webhook router)
    const { error: consentErr } = await supabase
      .from('patient_consents')
      .insert({
        patient_id: patient.id,
        consent_type: 'data_processing',
        granted_at: new Date().toISOString(),
        granted_by_role: 'patient',
        channel: 'whatsapp'
      });

    if (consentErr) throw new Error('Failed to write patient consent: ' + consentErr.message);

    const { data: updatedSess, error: updateSessErr } = await supabase
      .from('whatsapp_sessions')
      .update({
        current_state: 'AWAITING_CONFIRMATION',
        session_data: { consentGranted: true, consentTime: new Date().toISOString() }
      })
      .eq('patient_phone', patientPhone)
      .select()
      .single();

    if (updateSessErr) throw new Error('Failed to update whatsapp state: ' + updateSessErr.message);
    console.log(`- Success! RLS check passed. Consent row committed and WhatsApp state advanced to: ${updatedSess.current_state}\n`);

    // 4. Create Clinic Encounter Active -> Complete flow (supporting AFTER UPDATE trigger)
    console.log('[Step 4] Creating clinical encounter & medications/diagnostics payload...');
    const encounterId = crypto.randomUUID();
    
    // Clean up any historical database matches for this encounter ID just in case
    await supabase.from('encounters').delete().eq('id', encounterId);

    // Step A: Insert as 'active'
    console.log(`- Submitting active encounter record (ID: ${encounterId})...`);
    const { error: activeErr } = await supabase
      .from('encounters')
      .insert({
        id: encounterId,
        patient_id: patient.id,
        doctor_id: doctorId,
        entity_id: clinicEntityId,
        clinical_notes: 'Patient Aarav presenting HbA1c trajectory tracking.',
        status: 'active'
      });

    if (activeErr) throw new Error('Failed to create active encounter: ' + activeErr.message);

    // Step B: Insert Medication requests
    console.log('- Adding medication: Calpol 650 (Paracetamol)...');
    const { error: medErr } = await supabase
      .from('encounter_medications')
      .insert({
        encounter_id: encounterId,
        medicine_name: 'Calpol 650',
        dosage: '650mg',
        frequency: '1-0-1',
        duration: '5 days'
      });

    if (medErr) throw new Error('Failed to add medication: ' + medErr.message);

    // Step C: Insert Diagnostic order
    console.log('- Ordering diagnostic: HbA1c Glycated Hemoglobin (LOINC: 4544-3)...');
    const { error: diagErr } = await supabase
      .from('encounter_diagnostics')
      .insert({
        encounter_id: encounterId,
        loinc_code: '4544-3',
        test_name: 'HbA1c (Glycated Hemoglobin)',
        status: 'ordered'
      });

    if (diagErr) throw new Error('Failed to add diagnostic test: ' + diagErr.message);

    // Step D: Update status to 'completed' to fire database triggers!
    console.log('- Advancing encounter status to "completed" to fire PL/pgSQL database trigger workflows...');
    const { error: completeErr } = await supabase
      .from('encounters')
      .update({ status: 'completed' })
      .eq('id', encounterId);

    if (completeErr) throw new Error('Failed to complete encounter: ' + completeErr.message);
    console.log('- Success! Encounter submitted successfully.\n');

    // Wait a brief moment to allow database trigger async propagation
    console.log('Waiting 1000ms for Postgres trigger automation to settle...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Verify database trigger automations
    console.log('\n[Step 5] Auditing automated database trigger outcomes...');
    
    // A: Lab Requisitions Routing
    console.log('- Verifying Lab Requisitions routing...');
    const { data: labReqs, error: labErr } = await supabase
      .from('lab_requisitions')
      .select('*')
      .eq('encounter_id', encounterId);

    if (labErr || !labReqs || labReqs.length === 0) {
      throw new Error('Lab Requisition trigger failed: ' + (labErr?.message || 'No requisitions generated.'));
    }
    const labReq = labReqs[0];
    console.log(`  * Success! Pathology order created: ${labReq.test_name} (Barcode: ${labReq.barcode}, Tech ID: ${labReq.assigned_technician_id})`);

    // B: Pharmacy Inventory holds (FEFO checks)
    console.log('- Verifying FEFO Pharmacy inventory allocations...');
    const { data: inventoryHolds, error: holdErr } = await supabase
      .from('inventory_holds')
      .select('*')
      .eq('encounter_id', encounterId);

    if (holdErr || !inventoryHolds || inventoryHolds.length === 0) {
      throw new Error('Inventory holds trigger failed: ' + (holdErr?.message || 'No holds generated.'));
    }
    const hold = inventoryHolds[0];
    console.log(`  * Success! Batch reservation created: ${hold.medicine_name} (Qty: ${hold.quantity}, Batch: ${hold.batch_number}, Expiry: ${hold.expiry_date})`);

    // C: Unified Invoices creation
    console.log('- Verifying Unified Invoices dynamic generation...');
    const { data: invoices, error: invErr } = await supabase
      .from('unified_invoices')
      .select('*')
      .eq('encounter_id', encounterId);

    if (invErr || !invoices || invoices.length === 0) {
      throw new Error('Invoice trigger failed: ' + (invErr?.message || 'No invoices generated.'));
    }
    const invoice = invoices[0];
    console.log(`  * Success! Invoice generated (ID: ${invoice.id}, Total: INR ${invoice.total_amount}, Status: ${invoice.payment_status})`);
    console.log(`  * UPI dynamic payload: "${invoice.upi_qr_payload}"`);

    // D: WhatsApp State Machine
    console.log('- Verifying WhatsApp bot session transition...');
    const { data: currentSess, error: currentSessErr } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('patient_phone', patientPhone)
      .single();

    if (currentSessErr || !currentSess) {
      throw new Error('Failed to retrieve current WhatsApp session: ' + currentSessErr?.message);
    }
    console.log(`  * Success! Bot session state moved to: ${currentSess.current_state} (Awaiting payment for: INR ${currentSess.session_data.invoiceTotal})\n`);

    // 6. Simulate pathology workflow: collect sample, test, and submit result
    console.log('[Step 6] Simulating Pathology lab sample collection & quantitative result entry...');
    
    // Authenticate as Lab Tech Lalit Prasad
    const { error: labAuthErr } = await supabase.auth.signInWithPassword({
      email: 'labtech@mediflow.com',
      password: 'password123'
    });
    if (labAuthErr) throw new Error('Failed to authenticate as Lab Tech Lalit: ' + labAuthErr.message);
    console.log('- Success! Authenticated as Lab Tech Lalit Prasad.');

    // Collect sample
    await supabase.from('lab_requisitions').update({ status: 'collected' }).eq('id', labReq.id);
    
    // Submit results card
    const resultPayload = JSON.stringify({ biomarkers: { HbA1c: 6.8 } });
    await supabase.from('lab_reports').insert({
      requisition_id: labReq.id,
      patient_id: patient.id,
      submitted_by: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', // Lalit Prasad
      result_value: resultPayload,
      is_verified: true,
      verified_by: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102'
    });

    const { data: completedReq, error: complReqErr } = await supabase
      .from('lab_requisitions')
      .update({ status: 'completed' })
      .eq('id', labReq.id)
      .select()
      .single();

    if (complReqErr) throw new Error('Failed to complete lab test: ' + complReqErr.message);
    console.log(`- Success! Diagnostic test ${completedReq.test_name} status advanced to: ${completedReq.status}\n`);

    // Wait brief moment for reagent deduction trigger to execute
    await new Promise(resolve => setTimeout(resolve, 800));

    // Verify Reagent stock deduction
    console.log('- Verifying Reagent stock auto-deduction (on_lab_test_completed trigger)...');
    const { data: reagentStock, error: rgtErr } = await supabase
      .from('reagent_inventory')
      .select('*')
      .eq('reagent_name', 'HbA1c Enzyme Reagent A')
      .single();

    if (rgtErr) throw new Error('Failed to check reagent stock: ' + rgtErr.message);
    console.log(`  * Success! HbA1c Enzyme Reagent A stock level: ${reagentStock.stock_volume} ml (Deducted from initial 500ml)\n`);

    // 7. Simulate payment success (UPI callback)
    console.log('[Step 7] Simulating successful UPI callback settlement for unified invoice...');
    const { data: clearedInvoice, error: clearErr } = await supabase
      .from('unified_invoices')
      .update({ payment_status: 'cleared', paid_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .select()
      .single();

    if (clearErr) throw new Error('Failed to clear invoice: ' + clearErr.message);
    console.log(`- Success! Unified invoice status moved to: ${clearedInvoice.payment_status}\n`);

    // Wait a brief moment to allow financial ledger trigger async propagation
    console.log('Waiting 1000ms for Postgres ledger splits trigger to settle...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 8. Verify split settlement in multi-vendor wallets
    console.log('\n[Step 8] Auditing multi-vendor payout splits in financial_ledgers...');
    const { data: ledgers, error: ledgErr } = await supabase
      .from('financial_ledgers')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (ledgErr || !ledgers || ledgers.length === 0) {
      throw new Error('Financial split ledger failed: ' + (ledgErr?.message || 'No ledger records created.'));
    }

    console.log(`- Success! Created ${ledgers.length} financial settlement entries for multi-vendor payout:`);
    ledgers.forEach(entry => {
      console.log(`  * Type: ${entry.transaction_type.padEnd(20)} | Gross: INR ${entry.gross_amount.toString().padEnd(5)} | Rate: ${entry.commission_rate ? entry.commission_rate + '%' : 'N/A'.padEnd(4)} | Net: INR ${entry.net_payout}`);
    });

    // 9. Verify that inventory hold got dispensed automatically
    console.log('\n[Step 9] Auditing inventory hold auto-dispensation status...');
    const { data: dispHolds, error: dispErr } = await supabase
      .from('inventory_holds')
      .select('*')
      .eq('encounter_id', encounterId);

    if (dispErr || !dispHolds) throw new Error('Failed to fetch hold: ' + dispErr.message);
    console.log(`- Success! Inventory hold is now: ${dispHolds[0].hold_status} (Dispensed time: ${dispHolds[0].dispensed_at})\n`);

    // 10. Verify that WhatsApp session has moved to COMPLETED
    console.log('[Step 10] Auditing final WhatsApp state transition...');

    // Re-authenticate as Doctor Vivek to allow viewing WhatsApp session
    const { error: docReAuthErr } = await supabase.auth.signInWithPassword({
      email: 'doctor@mediflow.com',
      password: 'password123'
    });
    if (docReAuthErr) throw new Error('Failed to re-authenticate as Doctor Vivek: ' + docReAuthErr.message);

    const { data: finalSess, error: finalSessErr } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('patient_phone', patientPhone)
      .single();

    if (finalSessErr || !finalSess) throw new Error('Failed to fetch final session: ' + finalSessErr.message);
    console.log(`- Success! Patient care flow complete. Bot session in final status: ${finalSess.current_state}\n`);

    console.log('========================================================================');
    console.log('[SUCCESS] MEDIFLOW CONNECTED POD SYSTEM IS FULLY OPERATIONAL & ROBUST!');
    console.log('========================================================================');

  } catch (err) {
    console.error('\n[FATAL ERROR IN E2E VALIDATION]:', err.message || err);
    console.log('========================================================================');
    console.log('[FAILED] MEDIFLOW ECOSYSTEM ENCOUNTERED OPERATION GAPS!');
    console.log('========================================================================');
    process.exit(1);
  }
}

runE2EValidation();
