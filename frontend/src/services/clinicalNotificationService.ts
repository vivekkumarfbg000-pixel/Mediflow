import { supabase } from '../lib/supabaseClient';
import { WhatsAppService } from './whatsappService';
import { getPodContext } from './podContext';
import { writeAuditLog } from './apiHelper';

export interface LabReportNotificationParams {
  patientPhone: string;
  patientName: string;
  testName: string;
  loincCode?: string;
  biomarkers?: Record<string, any>;
  reportPdfUrl?: string;
  doctorName?: string;
  clinicName?: string;
}

export interface PrescriptionDosageParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  medications: Array<{
    medicineName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  clinicalNotes?: string;
  hinglishAdvice?: string;
  eveningSlot?: {
    startTime: string;
    endTime: string;
  } | null;
}

export interface FreeFollowupLoyaltyParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  expiryDays?: number;
}

export interface AppointmentTimingGreetingParams {
  patientPhone: string;
  patientName: string;
  tokenNumber?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  doctorName?: string;
  clinicName?: string;
  mode?: 'physical' | 'virtual';
  isEmergency?: boolean;
}

export interface VirtualConsultMeetingParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  appointmentTime?: string;
  appointmentDate?: string;
  meetingUrl: string;
}

export interface DailyDosageReminderParams {
  patientPhone: string;
  patientName: string;
  clinicName?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  medications: Array<{
    name: string;
    dosage?: string;
    instruction?: string;
  }>;
}

export interface LabArrivalRevisitParams {
  patientPhone: string;
  patientName: string;
  testName: string;
  revisitSlotTime?: string;
  revisitSlotDate?: string;
  revisitNote?: string;
  doctorName?: string;
  clinicName?: string;
}

export class ClinicalNotificationService {
  /**
   * Translates technical prescription dosage codes (1-0-1, OD, BD, TDS)
   * into clean, patient-friendly conversational Hinglish instructions.
   */
  public static formatDosageHinglish(dosage?: string, frequency?: string): string {
    const raw = `${dosage || ''} ${frequency || ''}`.trim().toLowerCase();

    if (raw.includes('1-0-1') || raw.includes('twice daily') || raw.includes('bd') || raw.includes('bid')) {
      return 'Subah 1 goli (khane ke baad) + Raat ko 1 goli (khane ke baad)';
    }
    if (raw.includes('1-0-0') || raw.includes('once daily (morning)') || raw.includes('od') || raw.includes('morning')) {
      return 'Subah 1 goli (Khali pet ya naste ke baad)';
    }
    if (raw.includes('0-0-1') || raw.includes('night') || raw.includes('bedtime') || raw.includes('hs')) {
      return 'Raat ko 1 goli (Sone se pehle khane ke baad)';
    }
    if (raw.includes('1-1-1') || raw.includes('thrice daily') || raw.includes('tds') || raw.includes('tid')) {
      return 'Subah, Dopahar aur Raat ko 1-1 goli (khane ke baad)';
    }
    if (raw.includes('0-1-0') || raw.includes('afternoon')) {
      return 'Dopahar ko 1 goli (dopahar khane ke baad)';
    }
    if (raw.includes('2-0-2')) {
      return 'Subah 2 goli aur Raat ko 2 goli (khane ke baad)';
    }
    if (raw.includes('sos') || raw.includes('as needed')) {
      return 'Zaroorat padne par hi lena hai (Jab dard ya taqleef ho)';
    }

    return dosage || frequency || 'Doctor ki salah ke hisab se regular lein';
  }

  /**
   * Generates clinically accurate, accessible Hinglish explanations for pathology lab results.
   */
  public static generateHinglishLabInterpretation(
    loincCode?: string,
    testName?: string,
    biomarkers?: Record<string, any>
  ): string {
    const code = loincCode || '';
    const name = (testName || '').toLowerCase();
    const data = biomarkers || {};

    // 1. Diabetology: HbA1c
    if (code === '4544-3' || name.includes('hba1c') || name.includes('glycated')) {
      const val = parseFloat(data.HbA1c || data.hba1c || data.resultValue || '0');
      if (val > 0) {
        if (val > 8.0) {
          return `⚠️ *Aapka HbA1c ${val}% hai (Critical High)*: Pichle 3 mahino ka sugar level kaafi badha hua hai. Kripya bina deri kiye doctor se milkar dawa adjust karwayein aur meetha band karein.`;
        }
        if (val > 6.5) {
          return `⚠️ *Aapka HbA1c ${val}% hai (Diabetic Range)*: Sugar thoda uncha chal raha hai. Doctor ne regular walk, diet control aur time par dawa lene ki advice di hai.`;
        }
        if (val >= 5.7) {
          return `🟡 *Aapka HbA1c ${val}% hai (Prediabetes Range)*: Borderline sugar level hai. Meetha kam karein aur daily 30-minute exercise maintain karein.`;
        }
        return `🟢 *Aapka HbA1c ${val}% hai (Normal)*: Bahut badhiya! Aapka sugar level pichle 3 mahino se bilkul safe aur control mein hai.`;
      }
    }

    // 2. Renal / Kidney: Creatinine & eGFR
    if (code === '2160-0' || name.includes('creatinine') || name.includes('renal') || name.includes('kft')) {
      const cr = parseFloat(data.serumCreatinine || data.creatinine || data.resultValue || '0');
      if (cr > 0) {
        if (cr > 1.4) {
          return `⚠️ *Serum Creatinine ${cr} mg/dL (Elevated)*: Kidney par thoda load hai. Doctor ki salah ke anusar paryapt paani piyein, bina doctor ke painkiller na lein aur review karein.`;
        }
        return `🟢 *Serum Creatinine ${cr} mg/dL (Normal)*: Aapka kidney filtration aur urea balance bilkul Normal aur swasth hai!`;
      }
    }

    // 3. Hematology: Hemoglobin
    if (code === '3024-7' || name.includes('hemoglobin') || name.includes('cbc')) {
      const hb = parseFloat(data.hemoglobin || data.hb || data.resultValue || '0');
      if (hb > 0) {
        if (hb < 10.0) {
          return `⚠️ *Hemoglobin ${hb} g/dL (Mild Anemia)*: Khoon ki thodi kami hai. Doctor ke bataye anusar Iron supplements aur hare patte wali sabziyan lein.`;
        }
        return `🟢 *Hemoglobin ${hb} g/dL (Normal)*: Aapka blood count aur hemoglobin level bilkul tandurust hai!`;
      }
    }

    // 4. Thyroid: TSH
    if (code === '3016-3' || name.includes('tsh') || name.includes('thyroid')) {
      const tsh = parseFloat(data.TSH || data.tsh || data.resultValue || '0');
      if (tsh > 0) {
        if (tsh > 5.5) {
          return `⚠️ *TSH Level ${tsh} μIU/mL (Hypothyroid)*: Thyroid function thoda slow hai. Doctor subah khali pet thyroid ki dawa prescribe karenge.`;
        }
        return `🟢 *TSH Level ${tsh} μIU/mL (Normal)*: Aapka thyroid hormone balance bilkul sahi hai!`;
      }
    }

    return `Aapka lab report test results ke sath prepare ho gaya hai. Final medical review ke liye doctor se sampark karein. 🟢`;
  }

  /**
   * Directly dispatches outbound Meta Graph API request via Supabase Edge Relay
   * with automatic phone normalization (91 prefix) and non-blocking failure tolerance.
   */
  private static async relayMetaGraphApi(phone: string, text: string): Promise<void> {
    try {
      const cleanDigits = (phone || '').replace(/\D/g, '');
      if (!cleanDigits) return;
      const cleanToPhone = cleanDigits.length === 10 ? '91' + cleanDigits : cleanDigits;

      await supabase.functions.invoke('meta-webhook', {
        body: {
          action: 'send_manual_message',
          patientPhone: cleanToPhone,
          messageText: text
        }
      });
    } catch (relayErr) {
      console.warn('[ClinicalNotificationService] Meta Graph API edge relay notice:', relayErr);
    }
  }

  /**
   * 1. AUTOMATED LAB REPORT & HINGLISH SUMMARY DELIVERY
   */
  public static async dispatchLabReportWhatsApp(params: LabReportNotificationParams): Promise<string> {
    const { patientPhone, patientName, testName, loincCode, biomarkers, reportPdfUrl, doctorName, clinicName } = params;
    if (!patientPhone) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();
    const interpretation = this.generateHinglishLabInterpretation(loincCode, testName, biomarkers);

    let biomarkerLines = '';
    if (biomarkers && typeof biomarkers === 'object') {
      const entries = Object.entries(biomarkers).filter(([k]) => !k.endsWith('_unit') && k !== 'unit' && k !== 'testCode');
      if (entries.length > 0) {
        biomarkerLines = entries.map(([k, v]) => `• *${k}*: ${v}`).join('\n');
      }
    }

    let msg = `🔬 *${resolvedClinic} Diagnostics Report* 📋\n\n`;
    msg += `Namaste *${patientName}*! Aapka *${testName}* report verify aur publish ho gaya hai.\n\n`;

    if (biomarkerLines) {
      msg += `📊 *Report Biomarkers:*\n${biomarkerLines}\n\n`;
    }

    msg += `👉 *Report Guidance (Hinglish):*\n${interpretation}\n\n`;

    if (reportPdfUrl) {
      msg += `📥 *Official Electronic Lab Report (PDF):*\n🔗 ${reportPdfUrl}\n\n`;
    }

    msg += `🏥 *Next Step (Doctor Review):*\n`;
    msg += `${resolvedDoc} ke saath aapka 2-Touchpoint Review loop ready hai. Kripya niche diye gaye options me se choose kijiye:\n`;
    msg += `1️⃣ *Physical Review at Clinic* 🏥 (Doctor se clinic me milkar dawa adjust karwayein)\n`;
    msg += `2️⃣ *Virtual Video Call* 💻 (Ghar baithe video call par report check karwayein)\n\n`;
    msg += `Please reply *1* (Clinic Visit) ya *2* (Video Call)! Stay healthy! 🟢`;

    // 1. Update in-app WhatsApp Session Simulator & Supabase DB
    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);

    // 2. Direct Outbound Meta Graph API Relay
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_LAB_REPORT_DISPATCHED', {
      phone: patientPhone,
      patientName,
      testName,
      hasPdf: Boolean(reportPdfUrl)
    }, null);

    return msg;
  }

  /**
   * 2. AUTOMATED DOCTOR PRESCRIPTION DOSAGE & TIMING DELIVERY
   */
  public static async dispatchPrescriptionDosageWhatsApp(params: PrescriptionDosageParams): Promise<string> {
    const { patientPhone, patientName, doctorName, clinicName, medications, clinicalNotes, hinglishAdvice, eveningSlot } = params;
    if (!patientPhone) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();

    let msg = `🏥 *${resolvedClinic} Connected Care Plan* 🩺\n\n`;
    msg += `Namaste *${patientName}*! ${resolvedDoc} ne aapka checkup complete karke digital prescription update kar diya hai.\n\n`;

    if (hinglishAdvice || clinicalNotes) {
      msg += `👉 *Doctor's Advice (Hinglish):*\n_"${hinglishAdvice || clinicalNotes}"_\n\n`;
    }

    if (medications && medications.length > 0) {
      msg += `💊 *Prescribed Medications & Dawa Lene Ka Niyam:*\n\n`;
      medications.forEach((m, idx) => {
        const schedule = this.formatDosageHinglish(m.dosage, m.frequency);
        msg += `${idx + 1}. *${m.medicineName}*`;
        if (m.duration) msg += ` (${m.duration})`;
        msg += `\n   🕒 *Dose:* ${schedule}\n`;
        if (m.instructions) msg += `   ℹ️ ${m.instructions}\n`;
      });
      msg += `\n`;
    }

    if (eveningSlot) {
      msg += `🕒 *Same-Day Evening Slot Scheduled:*\n`;
      msg += `Aapka evening review slot *${eveningSlot.startTime}* to *${eveningSlot.endTime}* par reserved hai. Clinic reception par token show kijiye.\n\n`;
    }

    msg += `📦 Prescribed medicines clinic counter pharmacy par reserve hain. 10% discount ke sath collect kar sakte hain.\n`;
    msg += `Time par dawa lein aur swasth rahein! 🟢`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_PRESCRIPTION_DISPATCHED', {
      phone: patientPhone,
      patientName,
      medCount: medications.length
    }, null);

    return msg;
  }

  /**
   * 3. AUTOMATED FREE VIRTUAL FOLLOW-UP & LOYALTY UNLOCK DELIVERY
   */
  public static async dispatchFreeFollowupLoyaltyWhatsApp(params: FreeFollowupLoyaltyParams): Promise<string> {
    const { patientPhone, patientName, doctorName, clinicName, expiryDays = 15 } = params;
    if (!patientPhone) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();

    let msg = `🌟 *Welcome to ${resolvedClinic} Premium Care Club!* 🌟\n\n`;
    msg += `Namaste *${patientName}*! Humare clinic par aapka bill successfully settle ho gaya hai. Aapke *Premium Member Benefits* active kar diye gaye hain:\n\n`;
    msg += `1️⃣ 💻 *1 Free Virtual Follow-Up Consult:* Agle ${expiryDays} dino tak aap ${resolvedDoc} ke saath bilkul FREE video follow-up consult kar sakte hain (₹0 charge).\n`;
    msg += `2️⃣ 📉 *10% Flat Refill Discount:* Next medicine refill order par automatic 10% ki bachat milegi.\n`;
    msg += `3️⃣ 🤖 *Daily WhatsApp Health Assistant:* Daily dawa reminder aur sugar/BP tracking guide.\n`;
    msg += `4️⃣ 📄 *Instant Digital Reports:* Sabhi lab reports aur prescriptions lifetime is chat me available rahenge.\n\n`;
    msg += `Free video consult book karne ke liye kisi bhi samay is chat par *'BOOK'* ya *'VIDEO'* reply kijiye! 😊`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_LOYALTY_BENEFIT_DISPATCHED', {
      phone: patientPhone,
      patientName,
      expiryDays
    }, null);

    return msg;
  }

  /**
   * 4. AUTOMATED APPOINTMENT TIMING & GREETING NOTIFICATION
   */
  public static async dispatchAppointmentTimingGreetingWhatsApp(params: AppointmentTimingGreetingParams): Promise<string> {
    const { patientPhone, patientName, tokenNumber, appointmentDate, appointmentTime, doctorName, clinicName, mode = 'physical', isEmergency = false } = params;
    if (!patientPhone) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();
    const effectiveToken = tokenNumber || '#TK-001';

    let msg = '';
    if (isEmergency) {
      msg += `🚨 *EMERGENCY SOS APPOINTMENT CONFIRMED!* 🚨\n\n`;
      msg += `Namaste *${patientName}*! Aapka Emergency checkup slot Priority #1 par register ho gaya hai.\n\n`;
    } else {
      msg += `🎫 *${resolvedClinic} Checkup Booking Confirmed!* 🟢\n\n`;
      msg += `Namaste *${patientName}*! Aapka appointment safaltapoorvak schedule ho gaya hai.\n\n`;
    }

    msg += `📋 *Appointment Details:*\n`;
    msg += `• *Token Number:* ${effectiveToken}\n`;
    msg += `• *Doctor:* ${resolvedDoc}\n`;
    msg += `• *Clinic:* ${resolvedClinic}\n`;
    msg += `• *Mode:* ${mode === 'virtual' ? 'Virtual Video Consult 💻' : 'Physical OPD Visit 🏥'}\n`;
    if (appointmentDate) msg += `• *Date:* ${appointmentDate}\n`;
    if (appointmentTime) msg += `• *Reporting Time:* ${appointmentTime}\n`;
    msg += `• *Queue Status:* Active in Doctor Queue\n\n`;

    if (mode === 'physical') {
      msg += `🩺 *Clinic Visit Instructions:*\n`;
      msg += `1. Kripya reporting time se 10 minute pehle clinic counter par ye token show kijiye.\n`;
      msg += `2. Compounder aapka Blood Pressure, Pulse, aur Vitals record karke doctor room me guide karenge.\n\n`;
    } else {
      msg += `💻 *Virtual Instructions:*\n`;
      msg += `Aapko video consult link appointment time se pehle is WhatsApp chat par prapt ho jayegi.\n\n`;
    }

    msg += `Thank you for choosing ${resolvedClinic}! Stay healthy! 🟢`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_APPOINTMENT_TIMING_GREETING_DISPATCHED', {
      phone: patientPhone,
      patientName,
      tokenNumber: effectiveToken
    }, null);

    return msg;
  }

  /**
   * 5. AUTOMATED VIRTUAL APPOINTMENT JITSI MEETING LINK DELIVERY
   */
  public static async dispatchVirtualConsultMeetingLinkWhatsApp(params: VirtualConsultMeetingParams): Promise<string> {
    const { patientPhone, patientName, doctorName, clinicName, appointmentTime, appointmentDate, meetingUrl } = params;
    if (!patientPhone || !meetingUrl) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();

    let msg = `💻 *${resolvedClinic} Virtual Video Consult Active!* 🟢\n\n`;
    msg += `Namaste *${patientName}*! ${resolvedDoc} ke saath aapka video consult ready hai.\n\n`;
    msg += `🔗 *1-Click Video Call Link:*\n${meetingUrl}\n\n`;

    if (appointmentDate || appointmentTime) {
      msg += `🕒 *Scheduled Slot:* ${appointmentDate ? appointmentDate + ' ' : ''}${appointmentTime || ''}\n\n`;
    }

    msg += `📱 *Video Call Join Karne Ka Aasan Tarika:*\n`;
    msg += `1. Upar diye gaye blue link par click kijiye.\n`;
    msg += `2. Link aapke mobile browser me direct khulega (kisi app download ki zaroorat nahi hai).\n`;
    msg += `3. Camera aur Microphone allow kijiye aur doctor se baat kijiye.\n\n`;
    msg += `Consultation ke baad digital prescription isi chat par automatic deliver ho jayega. Thank you! 😊`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_VIRTUAL_MEETING_LINK_DISPATCHED', {
      phone: patientPhone,
      patientName,
      meetingUrl
    }, null);

    return msg;
  }

  /**
   * 6. AUTOMATED DAILY DOSAGE REMINDER DELIVERY
   */
  public static async dispatchDailyDosageReminderWhatsApp(params: DailyDosageReminderParams): Promise<string> {
    const { patientPhone, patientName, clinicName, timeOfDay, medications } = params;
    if (!patientPhone || !medications || medications.length === 0) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();

    const timeLabels = {
      morning: 'Subah Ka Samay (Morning Dose 🌅)',
      afternoon: 'Dopahar Ka Samay (Afternoon Dose ☀️)',
      evening: 'Sham Ka Samay (Evening Dose 🌇)',
      night: 'Raat Ka Samay (Night / Bedtime Dose 🌙)'
    };

    let msg = `⏰ *${resolvedClinic} Medicine Dose Reminder* 💊\n\n`;
    msg += `Namaste *${patientName}*! Yeh aapke ${timeLabels[timeOfDay] || 'dawa'} lene ka samay hai.\n\n`;
    msg += `📋 *Abhi lene wali dawaiyan:*\n`;

    medications.forEach((m, idx) => {
      msg += `${idx + 1}. *${m.name}*`;
      if (m.dosage) msg += ` — ${m.dosage}`;
      if (m.instruction) msg += ` (${m.instruction})`;
      msg += `\n`;
    });

    msg += `\n💧 Kripya taaza paani ke sath dawa lein aur khana na chhorein.\n`;
    msg += `Swasth rahein aur dhyan rakhein! 🟢`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_DOSAGE_REMINDER_DISPATCHED', {
      phone: patientPhone,
      patientName,
      timeOfDay,
      medCount: medications.length
    }, null);

    return msg;
  }

  /**
   * 7. AUTOMATED LAB ARRIVAL & DOCTOR RE-VISIT ALERT DELIVERY
   */
  public static async dispatchLabArrivalRevisitAlert(params: LabArrivalRevisitParams): Promise<string> {
    const { patientPhone, patientName, testName, revisitSlotTime, revisitSlotDate, revisitNote, doctorName, clinicName } = params;
    if (!patientPhone) return '';

    const resolvedClinic = clinicName || WhatsAppService.getDynamicClinicName();
    const resolvedDoc = doctorName || WhatsAppService.getActiveDoctorName();

    let msg = `📢 *${resolvedClinic} - Lab Report Arrived at Clinic* 🔬\n\n`;
    msg += `Namaste *${patientName}*! Aapka *${testName}* test result pathology lab se clinic receive ho gaya hai.\n\n`;

    if (revisitSlotTime) {
      msg += `🕒 *Doctor Re-visit Scheduled:*\n`;
      msg += `Doctor review ke liye aapka slot *${revisitSlotTime}* ${revisitSlotDate ? `(${revisitSlotDate})` : 'aaj shaam'} par set kiya gaya hai.\n`;
    } else {
      msg += `🕒 *Doctor Re-visit Window:*\n`;
      msg += `Doctor review ke liye shaam *04:00 PM - 06:00 PM* ke beech clinic visit karein.\n`;
    }

    if (revisitNote) {
      msg += `ℹ️ *Compounder Note:* ${revisitNote}\n`;
    }

    msg += `\n🏥 *Choose Review Mode:*\n`;
    msg += `1️⃣ *Physical Visit at Clinic* 🏥\n`;
    msg += `2️⃣ *Virtual Video Consult* 💻 (Ghar baithe video call)\n\n`;
    msg += `Please reply *1* ya *2* to confirm your choice! 🟢`;

    WhatsAppService.pushWhatsAppMessageFromBot(patientPhone, msg);
    await this.relayMetaGraphApi(patientPhone, msg);

    writeAuditLog('WHATSAPP_LAB_ARRIVAL_REVISIT_DISPATCHED', {
      phone: patientPhone,
      patientName,
      testName,
      revisitSlotTime
    }, null);

    return msg;
  }
}
