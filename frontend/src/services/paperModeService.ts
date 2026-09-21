/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║          VITALSYNC PAPER MODE SERVICE — AGENTIC PIPELINE                 ║
 * ║  Orchestrates: OCR → Patient Profile → Supabase → WhatsApp → PDF        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * PERMANENT WELCOME TEMPLATE POLICY:
 * The PAPER_MODE_WELCOME_TEMPLATE is Object.freeze()'d and will NEVER change
 * unless explicitly instructed by the clinic owner (Vivek). Do not modify it.
 */

import { supabase } from '../lib/supabaseClient';
import { WhatsAppService } from './whatsappService';
import { LabService } from './labService';
import { PatientService } from './patientService';
import { ChronicCareService, CHRONIC_PROTOCOLS } from './chronicCareService';
import { getIstOffsetDateString } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// PERMANENT LOCKED WELCOME TEMPLATE (Hinglish + Hindi, 6 clinic features)
// ⚠️  DO NOT MODIFY without explicit instruction from clinic owner ⚠️
// ─────────────────────────────────────────────────────────────────────────────
export const PAPER_MODE_WELCOME_TEMPLATE = Object.freeze(
  `🏥 *{ClinicName} mein aapka swagat hai!* 🙏\n\n` +
  `Namaste *{PatientName} Ji*!\n\n` +
  `Aapka *VitalSync Smart Health Card* taiyar ho gaya hai! 🎉\n` +
  `🆔 *Patient ID:* {PatientID}\n` +
  `📱 Yeh WhatsApp aapka Digital Health Locker hai.\n\n` +
  `━━━━━━━━━━━━━━━━━━━━\n` +
  `🌟 *HAMARE SERVICES* 🌟\n` +
  `━━━━━━━━━━━━━━━━━━━━\n\n` +
  `1️⃣ 🏥 *OPD Appointment Book Karein*\n` +
  `   Seat pahle se reserve karein — clinic mein wait nahi!\n` +
  `   _(Reply: 1 ya BOOK)_\n\n` +
  `2️⃣ 💻 *Virtual Video Consult*\n` +
  `   Ghar baithe Dr. {DoctorName} se baat karein.\n` +
  `   _(Reply: 2 ya VIDEO)_\n\n` +
  `3️⃣ 🚨 *Emergency / VIP Priority Booking*\n` +
  `   Urgent zaroorat mein PRIORITY #1 — doctor seedha alert ho jaate hain!\n` +
  `   _(Reply: 4 ya SOS)_\n\n` +
  `4️⃣ 👑 *FREE VIP Member Benefits*\n` +
  `   Jab Partner Pharmacy se medicines aur Partner Lab se tests karein:\n` +
  `   ✅ 1 FREE Virtual Follow-up Consult (15-20 din tak)\n` +
  `   ✅ Har chronic medicine refill par 10% OFF\n` +
  `   ✅ Daily dawa reminder on WhatsApp\n` +
  `   ✅ Instant PDF Lab Reports seedhe is chat mein\n\n` +
  `5️⃣ 💊 *1-Click Medicine Refill*\n` +
  `   Dawa khatam hone se pehle hum remind karenge — 1 tap mein order!\n` +
  `   _(Reply: 5 ya REFILL)_\n\n` +
  `6️⃣ 🔬 *Lab Reports Yahan Dekho*\n` +
  `   Sabhi reports directly is WhatsApp chat mein available.\n` +
  `   _(Reply: 3 ya REPORT)_\n\n` +
  `━━━━━━━━━━━━━━━━━━━━\n` +
  `📋 *Digital Prescription Abhi Bhej Rahe Hain...*\n` +
  `Dr. {DoctorName} ki parchee PDF mein aapko abhi milegi! 💊\n\n` +
  `Madad ke liye *HELP* reply karein! 🩺\n` +
  `━━━━━━━━━━━━━━━━━━━━\n` +
  `_VitalSync Smart Virtual Hospital_ ✨`
);

// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL PRESCRIPTION WHATSAPP MESSAGE TEMPLATE (sent after welcome)
// ─────────────────────────────────────────────────────────────────────────────
export const PRESCRIPTION_WHATSAPP_TEMPLATE = Object.freeze(
  `📋 *Digital Prescription Taiyar Hai!* 💊\n\n` +
  `Namaste *{PatientName} Ji*! 🙏\n` +
  `Dr. {DoctorName} ki aapki digital parchee:\n\n` +
  `{MedicineList}\n\n` +
  `{TestList}\n` +
  `💡 Dawa samay par lena na bhoolein!\n` +
  `_Dr. {DoctorName} | {ClinicName}_`
);

// ─────────────────────────────────────────────────────────────────────────────
// BILL WHATSAPP MESSAGE TEMPLATE (dispatched on bill finalization)
// ─────────────────────────────────────────────────────────────────────────────
export const BILL_WHATSAPP_TEMPLATE = Object.freeze(
  `🧾 *{ClinicName} — Bill Taiyar Hai* 💳\n\n` +
  `Namaste *{PatientName} Ji*! 🙏\n` +
  `Aaj ka aapka bill:\n\n` +
  `{BillLines}` +
  `─────────────────\n` +
  `💰 *Kul Rakam (Total): ₹{Total}*\n\n` +
  `Shukriya! Aapki seva karna hamare liye khushi ki baat hai. 😊\n` +
  `_VitalSync Smart Virtual Hospital_ ✨`
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export interface PaperModePatient {
  id: string;
  name: string;
  phone: string | null;
  age: number;
  gender: string;
  address: string | null;
  isChronic: boolean;
  chronicConditions: string[];
}

export interface PaperModeMedication {
  medicineName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  route?: string;
}

export interface PaperModeResult {
  patient: PaperModePatient;
  prescriptionImageUrl: string | null;
  rxId: string;
  welcomeMessageSent: boolean;
  prescriptionMessageSent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAPER MODE SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────
export class PaperModeService {
  /**
   * STAGE 3 — Persist Digitized Prescription to Supabase
   * Saves to saas_prescriptions and updates patient_registry
   */
  static async persistPrescriptionToSupabase(params: {
    patientId: string;
    patientName: string;
    patientPhone: string | null;
    patientAddress?: string | null;
    doctorName?: string;
    clinicName?: string;
    diagnosis?: string | null;
    medications: PaperModeMedication[];
    diagnosticTests: any[];
    isChronic?: boolean;
    chronicConditions?: string[];
    prescriptionImageFile?: File | null;
    appointmentId?: string | null;  // ✅ Auto-created appointment linkage
  }): Promise<{ rxId: string; prescriptionImageUrl: string | null }> {
    const rxId = 'RX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    let prescriptionImageUrl: string | null = null;

    // A: Upload prescription image to Supabase storage if file is provided
    if (params.prescriptionImageFile && typeof window !== 'undefined') {
      try {
        const fileExt = params.prescriptionImageFile.name.split('.').pop() || 'jpg';
        const fileName = `${params.patientId}/${rxId}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('prescription-scans')
          .upload(fileName, params.prescriptionImageFile, { upsert: true });

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage
            .from('prescription-scans')
            .getPublicUrl(fileName);
          prescriptionImageUrl = publicUrlData?.publicUrl || null;
        } else {
          console.warn('[PaperMode] Image upload notice:', uploadErr.message);
        }
      } catch (err: any) {
        console.warn('[PaperMode] Storage upload notice:', err?.message);
      }
    }

    // B: Construct and upsert saas_prescriptions record
    const rxRecord = {
      id: rxId,
      patient_id: params.patientId,
      patient_name: params.patientName,
      patient_phone: params.patientPhone,
      patient_address: params.patientAddress || null,
      doctor_name: params.doctorName || 'Dr. Pankaj Kumar',
      diagnosis: params.diagnosis || null,
      medications: params.medications || [],
      diagnostic_tests: params.diagnosticTests || [],
      is_chronic: params.isChronic || false,
      chronic_conditions: params.chronicConditions || [],
      prescription_image_url: prescriptionImageUrl,
      appointment_id: params.appointmentId || null,  // ✅ Linked to auto-created appointment
      source: 'paper_scan',
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('saas_prescriptions').upsert(rxRecord, { onConflict: 'id' });
      console.log('[PaperMode] ✅ saas_prescriptions record saved');
    } catch (err: any) {
      console.warn('[PaperMode] saas_prescriptions save notice:', err?.message);
    }

    // C: Update patient_registry with address + chronic flags
    try {
      await supabase.from('patient_registry').update({
        address: params.patientAddress,
        is_chronic: params.isChronic,
        chronic_conditions: params.chronicConditions
      }).eq('id', params.patientId);
      console.log('[PaperMode] ✅ patient_registry updated');
    } catch (err: any) {
      console.warn('[PaperMode] patient_registry update notice:', err?.message);
    }

    // D: Auto-Ingest into chronic_care_cohorts & Sovereign Pod Realtime CDC
    try {
      await ChronicCareService.autoIngestFromEncounter({
        patientId: params.patientId,
        patientName: params.patientName,
        patientPhone: params.patientPhone || '',
        doctorId: params.doctorName || '',
        diagnosis: params.diagnosis || '',
        clinicalNotes: (params.chronicConditions || []).join(' '),
        medications: params.medications || [],
        isChronic: params.isChronic,
        chronicConditions: params.chronicConditions
      });
      console.log('[PaperMode] ✅ Auto-ingested chronic patient into chronic_care_cohorts via unified autoIngestFromEncounter');
    } catch (cohortErr: any) {
      console.warn('[PaperMode] Chronic cohort auto-ingestion notice:', cohortErr?.message);
    }

    return { rxId, prescriptionImageUrl };
  }

  /**
   * STAGE 4 — Dispatch PERMANENT Welcome WhatsApp Message
   * Instantaneous dispatch on patient profile creation
   */
  static dispatchWelcomeWhatsApp(params: {
    patientPhone: string;
    patientName: string;
    patientId: string;
    doctorName?: string;
    clinicName?: string;
  }): void {
    if (!params.patientPhone) {
      console.warn('[PaperMode] No phone — welcome WhatsApp skipped');
      return;
    }

    const msg = PAPER_MODE_WELCOME_TEMPLATE
      .replace(/\{ClinicName\}/g, params.clinicName || 'Clinic')
      .replace(/\{PatientName\}/g, params.patientName)
      .replace(/\{PatientID\}/g, `VT-${params.patientId.slice(0, 8).toUpperCase()}`)
      .replace(/\{DoctorName\}/g, params.doctorName || 'Doctor');

    // Non-blocking dispatch — UI never waits for this
    Promise.resolve().then(async () => {
      try {
        WhatsAppService.pushWhatsAppMessageFromBot(params.patientPhone, msg);
        await WhatsAppService.sendWhatsAppMessagePayload(params.patientPhone, 'custom_text', { replyText: msg });
        console.log('[PaperMode] ✅ Welcome WhatsApp dispatched to', params.patientPhone.slice(-4));
      } catch (waErr) {
        console.warn('[PaperMode] Welcome WA dispatch notice:', waErr);
      }
    });
  }

  /**
   * Translates common clinical frequencies to Hinglish for patients
   */
  static toHinglishFrequency(freq: string, duration: string, qty?: number): string {
    const map: Record<string, string> = {
      '1-0-0': 'Subah 1 Tab (Khane ke baad)',
      '0-0-1': 'Raat 1 Tab (Sone se pehle)',
      '1-0-1': 'Subah 1 Tab + Raat 1 Tab',
      '0-1-1': 'Dopahar 1 Tab + Raat 1 Tab',
      '1-1-1': 'Subah + Dopahar + Raat — 1-1-1',
      'OD':    'Roz ek baar (Once Daily)',
      'BD':    'Din mein 2 baar',
      'TDS':   'Din mein 3 baar',
      'SOS':   'Zaroorat par hi lein (Pain/Fever mein)',
      'HS':    'Raat ko sone se pehle',
      'AC':    'Khane se pehle',
      'PC':    'Khane ke baad',
    };
    const cleanFreq = (freq || '').trim().toUpperCase();
    const hinglishFreq = map[cleanFreq] || freq || '';
    const durStr = duration ? ` | ${duration}` : '';
    const qtyStr = qty ? ` | ${qty} tabs` : '';
    return `${hinglishFreq}${durStr}${qtyStr}`;
  }

  /**
   * STAGE 5 — Dispatch Digital Prescription WhatsApp
   * Sent after welcome, contains medicine list + PDF link
   */
  static dispatchPrescriptionWhatsApp(params: {
    patientPhone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    medications: PaperModeMedication[];
    diagnosticTests: any[];
    prescriptionImageUrl: string | null;
  }): void {
    if (!params.patientPhone) return;

    const medicineLines = (params.medications || []).map((m, i) =>
      `${i + 1}. 💊 *${m.medicineName}* — ${m.dosage || ''}\n   _${PaperModeService.toHinglishFrequency(m.frequency || '', m.duration || '', m.quantity)}_`
    ).join('\n\n');

    const testLines = (params.diagnosticTests || []).length > 0
      ? `🔬 *Lab Tests Ordered:*\n${(params.diagnosticTests).map((t: any, i: number) => `${i + 1}. ${t.name || t.testName || 'Lab Test'}`).join('\n')}\n\n`
      : '';

    const pdfLine = params.prescriptionImageUrl
      ? `📎 *Prescription Scan:* ${params.prescriptionImageUrl}\n\n`
      : '';

    const msg = PRESCRIPTION_WHATSAPP_TEMPLATE
      .replace('{PatientName}', params.patientName)
      .replace(/\{DoctorName\}/g, params.doctorName || 'Doctor')
      .replace('{ClinicName}', params.clinicName || 'Clinic')
      .replace('{MedicineList}', medicineLines ? `💊 *Dawaiyan (Medicines):*\n${medicineLines}\n` : '')
      .replace('{TestList}', testLines + pdfLine);

    Promise.resolve().then(async () => {
      try {
        // 3-second delay so welcome message arrives first
        await new Promise(r => setTimeout(r, 3000));
        WhatsAppService.pushWhatsAppMessageFromBot(params.patientPhone, msg);
        await WhatsAppService.sendWhatsAppMessagePayload(params.patientPhone, 'custom_text', { replyText: msg });
        console.log('[PaperMode] ✅ Prescription WhatsApp dispatched');
      } catch (waErr) {
        console.warn('[PaperMode] Prescription WA dispatch notice:', waErr);
      }
    });
  }

  /**
   * STAGE 6 — Dispatch Bill WhatsApp on Finalization
   */
  static dispatchBillWhatsApp(params: {
    patientPhone: string;
    patientName: string;
    clinicName: string;
    consultTotal: number;
    pharmacySub: number;
    labSub: number;
    finalTotal: number;
  }): void {
    if (!params.patientPhone) return;

    let billLines = '';
    if ((params.consultTotal || 0) > 0) billLines += `🏥 Doctor Consultation: *₹${params.consultTotal.toFixed(2)}*\n`;
    if ((params.pharmacySub || 0) > 0) billLines += `💊 Pharmacy: *₹${params.pharmacySub.toFixed(2)}*\n`;
    if ((params.labSub || 0) > 0) billLines += `🔬 Lab Tests: *₹${params.labSub.toFixed(2)}*\n`;

    const msg = BILL_WHATSAPP_TEMPLATE
      .replace(/\{ClinicName\}/g, params.clinicName || 'Clinic')
      .replace('{PatientName}', params.patientName)
      .replace('{BillLines}', billLines)
      .replace('{Total}', (params.finalTotal || 0).toFixed(2));

    Promise.resolve().then(async () => {
      try {
        WhatsAppService.pushWhatsAppMessageFromBot(params.patientPhone, msg);
        await WhatsAppService.sendWhatsAppMessagePayload(params.patientPhone, 'custom_text', { replyText: msg });
        console.log('[PaperMode] ✅ Bill WhatsApp dispatched');
      } catch (waErr) {
        console.warn('[PaperMode] Bill WA dispatch notice:', waErr);
      }
    });
  }
}

