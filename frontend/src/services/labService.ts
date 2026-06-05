import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import type { LabRequisition, ReagentStock, PathologyReport, LabReport, DiagnosticTest } from '../types';

export const MASTER_TEST_CATALOG: DiagnosticTest[] = [
  { loincCode: '4544-3', name: 'HbA1c (Glycated Hemoglobin)', category: 'Diabetology', normalRange: '4.0 - 5.6', unit: '%', price: 350 },
  { loincCode: '2160-0', name: 'Serum Creatinine', category: 'Renal Panel', normalRange: '0.6 - 1.2', unit: 'mg/dL', price: 250 },
  { loincCode: '3024-7', name: 'Total Hemoglobin', category: 'Hematology', normalRange: '12.0 - 16.0', unit: 'g/dL', price: 150 },
  { loincCode: '2947-0', name: 'Serum Sodium', category: 'Electrolytes', normalRange: '135 - 145', unit: 'mEq/L', price: 200 },
  { loincCode: '1975-2', name: 'Total Bilirubin', category: 'Liver Function', normalRange: '0.2 - 1.2', unit: 'mg/dL', price: 300 }
];

export const OPHTHALMIC_TEST_CATALOG: DiagnosticTest[] = [
  { loincCode: '79892-0', name: 'OCT Macular Scan', category: 'Retinal Imaging', normalRange: 'N/A', unit: 'μm', price: 1500 },
  { loincCode: '79893-8', name: 'Visual Fields / Perimetry', category: 'Glaucoma Screening', normalRange: 'N/A', unit: 'dB', price: 1200 },
  { loincCode: '79894-6', name: 'Fundus Photography', category: 'Retinal Imaging', normalRange: 'N/A', unit: 'image', price: 800 },
  { loincCode: '79895-3', name: 'Corneal Topography', category: 'Refractive Surgery', normalRange: 'N/A', unit: 'D', price: 1500 },
  { loincCode: '79896-1', name: 'A-Scan Biometry (IOL)', category: 'Cataract Pre-op', normalRange: 'N/A', unit: 'mm', price: 1000 },
];

export const DEFAULT_REAGENT_STOCKS: ReagentStock[] = [
  { reagentName: 'HbA1c Enzyme Reagent A', stockVolume: 500, unit: 'ml' },
  { reagentName: 'Creatinine Alkaline Picrate B', stockVolume: 1000, unit: 'ml' },
  { reagentName: 'Drabkin Reagent (Hemoglobin)', stockVolume: 800, unit: 'ml' },
  { reagentName: 'Sodium Ion Reagent', stockVolume: 400, unit: 'ml' },
  { reagentName: 'Bilirubin Diazo Reagent', stockVolume: 600, unit: 'ml' }
];

export class LabService {
  static getLabRequisitions(): LabRequisition[] {
    return load<LabRequisition[]>('lab_requisitions', []);
  }

  static saveLabRequisitions(reqs: LabRequisition[]): void {
    save('lab_requisitions', reqs);
    notify();
  }

  static collectLabSample(reqId: string): void {
    const requisitions = this.getLabRequisitions();
    const idx = requisitions.findIndex(r => r.id === reqId);
    if (idx !== -1) {
      requisitions[idx].status = 'collected';
      save('lab_requisitions', requisitions);

      supabase.from('lab_requisitions').update({
        status: 'collected',
        updated_at: new Date().toISOString()
      }).eq('id', reqId).then(({ error }) => {
        if (error) console.error('Error collecting lab sample in Supabase:', error);
        else writeAuditLog('lab_sample_collected', { reqId }, reqId);
      });
    }
  }

  static getReagentStocks(): ReagentStock[] {
    return load<ReagentStock[]>('reagents', DEFAULT_REAGENT_STOCKS);
  }

  static submitLabResult(reqId: string, resultValue: string): void {
    const requisitions = this.getLabRequisitions();
    const idx = requisitions.findIndex(r => r.id === reqId);
    if (idx !== -1) {
      const req = requisitions[idx];
      req.quantitativeResult = resultValue;
      req.status = 'completed';

      const loincCode = req.testCode;
      let reagentName = '';
      let deductionVolume = 0;
      if (loincCode === '4544-3') {
        reagentName = 'HbA1c Enzyme Reagent A';
        deductionVolume = 1.5;
      } else if (loincCode === '2160-0') {
        reagentName = 'Creatinine Alkaline Picrate B';
        deductionVolume = 2.0;
      } else if (loincCode === '3024-7') {
        reagentName = 'Drabkin Reagent (Hemoglobin)';
        deductionVolume = 1.0;
      } else if (loincCode === '2947-0') {
        reagentName = 'Sodium Ion Reagent';
        deductionVolume = 1.2;
      } else if (loincCode === '1975-2') {
        reagentName = 'Bilirubin Diazo Reagent';
        deductionVolume = 1.8;
      }

      if (reagentName && deductionVolume > 0) {
        const reagents = this.getReagentStocks();
        const rIdx = reagents.findIndex(r => r.reagentName === reagentName);
        if (rIdx !== -1) {
          const currentStock = reagents[rIdx].stockVolume;
          const newStock = Math.max(0, currentStock - deductionVolume);
          reagents[rIdx].stockVolume = Number(newStock.toFixed(2));
          save('reagents', reagents);
          
          const autopilotEnabled = localStorage.getItem('reagent_autopilot_enabled') !== 'false';
          if (autopilotEnabled && newStock < 200) {
            const replenishVolume = 500;
            const finalStock = newStock + replenishVolume;
            reagents[rIdx].stockVolume = Number(finalStock.toFixed(2));
            save('reagents', reagents);
            
            supabase.from('reagent_inventory')
              .update({ stock_volume: finalStock })
              .eq('reagent_name', reagentName)
              .then(() => {
                writeAuditLog('reagent_autopilot_replenished', { reagentName, replenishedVolume: replenishVolume, oldStock: newStock, finalStock }, reagentName);
              });

            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                detail: {
                  message: `Autopilot Triggered: ${reagentName} fell below 200ml. Automatically ordered 500ml!`,
                  type: 'success',
                  title: 'Autopilot Active'
                }
              }));

              window.dispatchEvent(new CustomEvent('mediflow-reagent-autopilot', {
                detail: { reagentName, replenishedVolume: replenishVolume, timestamp: new Date().toISOString() }
              }));
            }, 600);
          }
        }
      }

      save('lab_requisitions', requisitions);

      supabase.from('lab_requisitions').update({
        status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', reqId).then(async ({ error }) => {
        if (error) {
          console.error('Error submitting lab results in Supabase:', error);
          return;
        }
        writeAuditLog('lab_result_submitted', { reqId, resultValue }, reqId);

        const patient = PatientService.getPatients().find(p => p.id === req.patientId);
        await supabase.from('lab_reports').insert({
          requisition_id: reqId,
          patient_id: req.patientId,
          patient_name: patient?.name || req.patientName || 'Unknown',
          biomarker_json: { testCode: req.testCode, testName: req.testName, resultValue },
          status: 'approved' // lab tech submit = auto-approved at technician level
        });

        // AI extraction and summary update
        try {
          const history = PatientService.getPatientHistoricalBiomarkers(req.patientId);
          let biomarkers: Record<string, any> = {};
          try {
            const parsed = JSON.parse(resultValue);
            biomarkers = parsed.biomarkers || {};
          } catch (e) {
            console.warn("Failed to parse resultValue:", e);
          }

          const current_data: Record<string, any> = {
            age: patient?.age?.toString() || '45',
            gender: patient?.gender || 'Male'
          };
          if (biomarkers.HbA1c !== undefined) current_data.HbA1c = biomarkers.HbA1c.toString();
          if (biomarkers.serumCreatinine !== undefined) current_data.creatinine = biomarkers.serumCreatinine.toString();
          if (biomarkers.hemoglobin !== undefined) current_data.hemoglobin = biomarkers.hemoglobin.toString();

          const { ForecastService } = await import('./forecastService');
          const trendResult = await ForecastService.labTrend({ current_data, historical_data: history });
          
          if (trendResult && trendResult.analysis) {
            await PatientService.updatePatientPastReportsSummary(req.patientId, trendResult.analysis);
          }
        } catch (aiErr) {
          console.error('[AI Biomarker Extraction/Summary update failed]:', aiErr);
        }
      });
    }
  }

  static replenishReagentStock(reagentName: string, volumeToAdd: number): void {
    const reagents = this.getReagentStocks();
    const idx = reagents.findIndex(r => r.reagentName === reagentName);
    if (idx !== -1) {
      reagents[idx].stockVolume = Number((reagents[idx].stockVolume + volumeToAdd).toFixed(2));
      save('reagents', reagents);
      notify();

      supabase.from('reagent_inventory')
        .update({ stock_volume: reagents[idx].stockVolume })
        .eq('reagent_name', reagentName)
        .then(({ error }) => {
          if (error) console.error('[Mediflow Lab] Failed to sync replenishment to Supabase:', error);
          else writeAuditLog('reagent_manually_replenished', { reagentName, volumeAdded: volumeToAdd, newTotal: reagents[idx].stockVolume });
        });
    }
  }

  static registerWalkinLabTest(patientId: string, testCode: string, testName: string, prescriptionFileUrl?: string): LabRequisition {
    const patients = PatientService.getPatients();
    const patient = patients.find(p => p.id === patientId);
    const barcode = `WALK-${Date.now()}-${testCode}`.toUpperCase();
    const reqId = crypto.randomUUID();

    if (prescriptionFileUrl) {
      const prescriptions = load<any[]>('saas_prescriptions', []);
      prescriptions.push({
        id: crypto.randomUUID(),
        appointmentId: reqId,
        prescriptionFileUrl,
        createdAt: new Date().toISOString()
      });
      save('saas_prescriptions', prescriptions);
    }

    const newReq: LabRequisition = {
      id: reqId,
      encounterId: 'walkin',
      patientId,
      patientName: patient?.name || 'Walk-in Patient',
      testCode,
      testName,
      barcode,
      status: 'pending',
      reagentDeductions: [],
      prescriptionFileUrl,
      createdAt: new Date().toISOString()
    };
    const existing = this.getLabRequisitions();
    existing.unshift(newReq);
    save('lab_requisitions', existing);
    notify();

    supabase.from('lab_requisitions').insert({
      id: newReq.id,
      encounter_id: null,
      patient_id: patientId,
      lab_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', // Seeded lab entity
      loinc_code: testCode,
      test_name: testName,
      barcode,
      status: 'pending',
      assigned_technician_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      created_at: newReq.createdAt
    }).then(({ error }) => {
      if (error) console.error('[Mediflow Lab] Walk-in requisition sync failed:', error);
      else writeAuditLog('walkin_lab_test_registered', { patientId, testCode, testName, barcode }, patientId);
    });

    return newReq;
  }

  static getPathologyReports(): PathologyReport[] {
    const defaultReports: PathologyReport[] = [
      {
        id: 'rep-201',
        patientId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317401',
        patientName: 'Aarav Sharma',
        loincCode: '4544-3',
        testName: 'HbA1c (Glycated Hemoglobin)',
        status: 'approved',
        compounderScanned: true,
        results: 'HbA1c level is 7.2% (Abnormal > 6.5% - Diabetic Glycemic range). Recommended: Metformin 500mg twice daily.',
        timestamp: '2026-05-24T14:20:00Z'
      },
      {
        id: 'rep-202',
        patientId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317402',
        patientName: 'Priyanka Verma',
        loincCode: '2160-0',
        testName: 'Serum Creatinine',
        status: 'pending',
        compounderScanned: true,
        timestamp: '2026-05-25T08:30:00Z'
      }
    ];
    return load<PathologyReport[]>('pathology_reports', defaultReports);
  }

  static savePathologyReports(reports: PathologyReport[]) {
    save('pathology_reports', reports);
    notify();
  }

  static processPathologyReport(reportId: string, results: string) {
    const reports = this.getPathologyReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx !== -1) {
      reports[idx].status = 'approved';
      reports[idx].results = results;
      this.savePathologyReports(reports);

      writeAuditLog('LAB_REPORT_APPROVED', {
        reportId,
        patientName: reports[idx].patientName,
        testName: reports[idx].testName,
        results
      });

      const ledgerEntries = load<any[]>('financial_ledgers', []);
      const testCatalogItem = MASTER_TEST_CATALOG.find(t => t.loincCode === reports[idx].loincCode);
      const activeSop = load<any>('clinic_sops', []).find((s: any) => s.isActive);
      
      const testPrice = activeSop?.extractedConfig?.test_prices?.[reports[idx].loincCode] ?? testCatalogItem?.price ?? 350;
      
      const splitDoc = activeSop?.extractedConfig?.splits?.doctor ?? 15;
      const splitPlat = 5;
      const splitLab = 100 - splitDoc - splitPlat;

      const platformAmt = parseFloat((testPrice * (splitPlat / 100)).toFixed(2));
      const docAmt = parseFloat((testPrice * (splitDoc / 100)).toFixed(2));
      const labAmt = parseFloat((testPrice * (splitLab / 100)).toFixed(2));

      const docLedger = {
        id: `tx-doc-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'clinic-admin-entity',
        transactionType: 'lab_commission',
        grossAmount: testPrice,
        commissionRate: splitDoc / 100, 
        netPayout: docAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const platformLedger = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: testPrice,
        commissionRate: splitPlat / 100,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const labLedger = {
        id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: `inv-rep-${reportId}`,
        sourceEntityId: 'lab-partner-entity',
        destinationEntityId: 'lab-partner-entity',
        transactionType: 'lab_commission',
        grossAmount: testPrice,
        commissionRate: splitLab / 100,
        netPayout: labAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      ledgerEntries.unshift(docLedger, platformLedger, labLedger);
      save('financial_ledgers', ledgerEntries);

      // Only sync to Supabase if there's a real UUID invoice reference
      // Pathology report ledger entries use local-only IDs (inv-rep-xxx) that are not real UUIDs
      // Skip Supabase sync to avoid FK constraint violations on financial_ledgers.invoice_id

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Lab Report Approved! 🧪',
          message: `Report approved. Splits: Doctor (₹${docAmt}) & Platform (₹${platformAmt}) & Lab (₹${labAmt}) settled!`,
          type: 'success'
        }
      }));
    }
  }

  static async uploadPrescriptionToStorage(file: File): Promise<string> {
    const fileName = `rx_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('prescriptions')
      .upload(fileName, file, { upsert: false, contentType: file.type });

    if (error) {
      console.warn('[Mediflow Storage] Prescription upload failed, using data URL fallback:', error.message);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const { data: signedData } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(data.path, 365 * 24 * 3600);

    return signedData?.signedUrl || data.path;
  }

  static createLabRequisitionFromPrescription(
    patientId: string,
    testCode: string,
    testName: string,
    prescriptionFileUrl: string
  ): LabRequisition {
    const patients = PatientService.getPatients();
    const patient = patients.find(p => p.id === patientId);
    const barcode = `RX-${Date.now()}-${testCode}`.toUpperCase();
    const reqId = crypto.randomUUID();

    const newReq: LabRequisition = {
      id: reqId,
      encounterId: `rx-dispatch-${reqId.substring(0, 8)}`,
      patientId,
      patientName: patient?.name || 'Unknown Patient',
      testCode,
      testName,
      barcode,
      status: 'pending',
      reagentDeductions: [],
      prescriptionFileUrl,
      createdAt: new Date().toISOString()
    };

    const existing = this.getLabRequisitions();
    existing.unshift(newReq);
    save('lab_requisitions', existing);
    notify();

    supabase.from('lab_requisitions').insert({
      id: newReq.id,
      encounter_id: null,
      patient_id: patientId,
      lab_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', // Seeded lab entity
      loinc_code: testCode,
      test_name: testName,
      barcode,
      status: 'pending',
      prescription_file_url: prescriptionFileUrl,
      assigned_technician_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', // Lalit Prasad
      created_at: newReq.createdAt
    }).then(({ error }) => {
      if (error) console.error('[Mediflow Lab] Prescription dispatch to lab failed:', error);
      else writeAuditLog('prescription_dispatched_to_lab', { patientId, testCode, testName, barcode, prescriptionFileUrl }, patientId);
    });

    return newReq;
  }

  static async uploadLabReportToStorage(file: File, requisitionId: string): Promise<string> {
    const ext = file.name.split('.').pop() || 'pdf';
    const fileName = `report_${requisitionId}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('lab-reports')
      .upload(fileName, file, { upsert: false, contentType: file.type });

    if (error) {
      console.warn('[Mediflow Storage] Lab report upload failed, using data URL fallback:', error.message);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const { data: signedData } = await supabase.storage
      .from('lab-reports')
      .createSignedUrl(data.path, 365 * 24 * 3600);

    return signedData?.signedUrl || data.path;
  }

  static getFullLabReports(): LabReport[] {
    return load<LabReport[]>('full_lab_reports', []);
  }

  static saveFullLabReport(report: LabReport): void {
    const reports = this.getFullLabReports();
    const idx = reports.findIndex(r => r.id === report.id);
    if (idx >= 0) reports[idx] = report;
    else reports.unshift(report);
    save('full_lab_reports', reports);
    notify();

    supabase.from('lab_reports').upsert({
      id: report.id,
      requisition_id: report.requisitionId,
      patient_id: report.patientId,
      patient_name: report.patientName,
      report_file_url: report.reportFileUrl || null,
      biomarker_json: report.biomarkerJson || null,
      status: report.status,
      approved_by: report.approvedBy || null,
      approved_at: report.approvedAt || null,
      rejection_reason: report.rejectionReason || null,
      revisit_scheduled_at: report.revisitScheduledAt || null,
      revisit_note: report.revisitNote || null
    }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.error('[Mediflow Lab] Failed to sync lab report to Supabase:', error);
    });
  }

  static async approveLabReport(
    reportId: string,
    revisitDate: string,
    revisitTime: string,
    revisitNote: string
  ): Promise<void> {
    const reports = this.getFullLabReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx < 0) return;

    const revisitAt = revisitDate && revisitTime
      ? new Date(`${revisitDate}T${revisitTime}:00`).toISOString()
      : undefined;

    const { data: { user } } = await supabase.auth.getUser();
    reports[idx].status = 'approved';
    reports[idx].approvedBy = user?.id || 'compounder';
    reports[idx].approvedAt = new Date().toISOString();
    reports[idx].revisitScheduledAt = revisitAt;
    reports[idx].revisitNote = revisitNote || undefined;
    reports[idx].updatedAt = new Date().toISOString();

    save('full_lab_reports', reports);
    notify();

    await supabase.from('lab_reports').update({
      status: 'approved',
      approved_by: user?.id || null,
      approved_at: reports[idx].approvedAt,
      revisit_scheduled_at: revisitAt || null,
      revisit_note: revisitNote || null
    }).eq('id', reportId);

    const report = reports[idx];
    const requisitions = this.getLabRequisitions();
    const reqIdx = requisitions.findIndex(r => r.id === report.requisitionId);
    if (reqIdx >= 0) {
      requisitions[reqIdx].revisitScheduledAt = revisitAt;
      requisitions[reqIdx].revisitNote = revisitNote;
      save('lab_requisitions', requisitions);

      await supabase.from('lab_requisitions').update({
        revisit_scheduled_at: revisitAt || null,
        revisit_note: revisitNote || null
      }).eq('id', report.requisitionId);
    }

    const patient = PatientService.getPatients().find(p => p.id === report.patientId);
    if (patient) {
      const revisitMsg = revisitAt
        ? `📅 Compounder ne aapko doctor se milkar *final advice* lene ke liye time allocate kiya hai: *${new Date(revisitAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} at ${revisitTime}*.`
        : '';
      const noteMsg = revisitNote ? `\n📌 *Note from compounder:* "${revisitNote}"` : '';
      const message = `✅ *Lab Report arrived at Doctor!* 🧪\n\nDear *${patient.name}*, aapka *${report.biomarkerJson?.testName || 'lab test'}* report doctor ke paas pahunch gaya hai. 🏥${revisitMsg ? '\n\n' + revisitMsg : ''}${noteMsg}\n\nKripya time par clinic aakar doctor se final advice lein. Dhyan rakhein! 🟢`;

      
      const sessions = load<any[]>('whatsapp_sessions', []);
      const existing = sessions.find(s => s.patientPhone === patient.phone);
      if (existing) {
        const currentHistory = existing.sessionData.chatHistory || [];
        currentHistory.push({ sender: 'bot', text: message, time: new Date().toISOString() });
        existing.sessionData = {
          ...existing.sessionData,
          chatHistory: currentHistory
        };
        save('whatsapp_sessions', sessions);
        
        await supabase.from('whatsapp_sessions').update({
          session_data: existing.sessionData,
          last_interaction: new Date().toISOString()
        }).eq('patient_phone', patient.phone);
      }
    }

    // Allocate patient back to doctor consult queue for final advice
    PatientService.updatePatientQueueStatus(report.patientId, 'awaiting_consultation');

    await writeAuditLog('LAB_REPORT_APPROVED', {
      reportId,
      patientId: report.patientId,
      revisitAt,
      revisitNote
    }, report.patientId);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Lab Report Approved ✅',
        message: revisitAt
          ? `Report approved. Revisit scheduled for ${new Date(revisitAt).toLocaleDateString('en-IN')}. WhatsApp sent!`
          : 'Report approved. WhatsApp notification sent to patient.',
        type: 'success'
      }
    }));
  }

  static async rejectLabReport(reportId: string, reason: string): Promise<void> {
    const reports = this.getFullLabReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx < 0) return;

    reports[idx].status = 'rejected';
    reports[idx].rejectionReason = reason;
    reports[idx].updatedAt = new Date().toISOString();
    save('full_lab_reports', reports);
    notify();

    await supabase.from('lab_reports').update({
      status: 'rejected',
      rejection_reason: reason
    }).eq('id', reportId);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'Report Rejected',
        message: `Lab report returned to technician for re-analysis. Reason: "${reason}"`,
        type: 'warning'
      }
    }));
  }
}
