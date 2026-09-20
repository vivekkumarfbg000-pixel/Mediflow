/**
 * ============================================================================
 * VitalSync Agentic WhatsApp Template Engine (WhatsAppTemplateEngine.ts)
 * 
 * Centralized, canonical, frozen Hinglish template registry & typed dispatchers
 * for all 10 clinical touchpoints + queue alerts + follow-up care loops.
 * 
 * Conforms strictly to:
 * - AGENTS.md Section 4 (WhatsApp Engine & 2-Touchpoint Care Loop)
 * - AGENTS.md Section 9 (Canonical Copy & Zero-Jargon Standard)
 * - Big Tech Directive 62 (Outbound dispatch first, non-blocking async)
 * ============================================================================
 */

import { WhatsAppService } from './whatsappService';

// ==========================================
// 1. CANONICAL FROZEN TEMPLATES
// ==========================================

export const CANONICAL_WHATSAPP_TEMPLATES = Object.freeze({
  /**
   * Template 1: Main Welcome Menu (6 Core Services)
   */
  WELCOME_MENU: `Namaste {PatientName}! 🙏 Welcome to {ClinicName}.

🌟 {CLINIC_NAME} SERVICES 🌟
1️⃣ Book Physical Clinic Visit 🏥
2️⃣ Book Virtual Video Consult 💻 (1 Free Consult Unlocked)
3️⃣ View Lab Reports & Hinglish Summary 🔬
4️⃣ Emergency SOS Priority #1 Routing 🚨
5️⃣ 1-Click Medicine Refill (10% OFF) 💊
6️⃣ Refer a Patient & Earn 10% OFF 🎁

Service select karne ke liye button tap kijiye ya number (1-6) reply kijiye! 🩺
[ Buttons: 🏥 Book Physical Visit | 💻 Book Virtual Video | 🚨 Emergency SOS ]`,

  /**
   * Template 2: Checkup Slot Selection & Locked State
   * Invariant: ZERO platform fee jargon. Never display (0% Platform Fee) or SaaS fees.
   */
  SLOT_LOCKED: `📅 *Checkup Slot Selected!*

{DoctorName} ke liye checkup slot *{SlotTime}* ({SlotDate}) at {ClinicName} lock kar diya gaya hai.

• Doctor Consultation Fee: *₹{DoctorFee}*

📱 *Doctor Direct UPI Se Pay Karein ya Portal Link Se:*
{PaymentPortalUrl}

Payment complete hone ke baad please *PAY* reply kijiye ya *[ I Have Paid ✅ ]* button tap kijiye! Turant token {TokenNumber} issue ho jayega 📑
[ Buttons: I Have Paid ✅ | Pay via Direct UPI 💳 ]`,

  /**
   * Template 3: Payment Cleared & Instant Sequential Token Issue
   */
  TOKEN_CONFIRMED: `🟢 *APPOINTMENT CONFIRMED & TOKEN ALLOCATED!*

Hi {PatientName}! {DoctorName} ke saath aapka checkup confirm ho gaya hai:

• Token Number: *{TokenNumber}* 🎫
• Queue Status: {AheadCount} Patients ahead of you (~{WaitMinutes} mins wait)
• Live Clinic Turn Alert: Turn aane se 2 patient pehle WhatsApp alert aayega!
• Clinic Location: {ClinicAddress}, Desk #1

Doctor EMR aur Compounder Desk par aapki entry live sync ho chuki hai. Thank you! 😊`,

  /**
   * Template 4: Touchpoint 2: Lab Report Delivery & 2-Button Review Loop
   */
  LAB_REPORT_READY: `📄 *Aapki Pathology Report Taiyar Hai!* 🔬

• Patient: {PatientName}
• Test: {TestName}
• Status: Verified & Approved 🟢
• AI Clinical Summary: {AiSummaryHinglish}
• Assigned Evening Slot: *{AssignedTime}*

📥 {PdfDownloadUrl}

Dr. {DoctorLastName} se report review ke liye option chuniye:
[ Buttons: 🏥 Physical Review at Clinic | 💻 Virtual Video Review ]
(Physical Review chune par aapki prescribed dawaiyan clinic pharmacy counter par reserve ho jayengi).`,

  /**
   * Template 5: Day-25 Automated Chronic Medicine Refill (10% OFF VIP Discount)
   */
  CHRONIC_REFILL_REMINDER: `Namaste {PatientName} Ji! 🩺
Aapki *{MedicineName}* dawa agle *{DaysLeft} dino mein khatam* hone wali hai.

Blood pressure/sugar control mein gap na aaye, isliye {ClinicName} Pharmacy ne aapka *1 Month Refill Pack (10% OFF)* ready rakha hai:

• MRP: ~₹{MrpAmount}~
• Your Price (10% VIP Discount): *₹{DiscountedAmount}*
• Delivery: Free Clinic Counter Pickup ya 24hr Home Delivery

[ Buttons: 📦 Confirm 1-Click Refill | 👨‍⚕️ Speak to Doctor ]`,

  /**
   * Template 6: Emergency SOS Priority #1 Routing
   */
  SOS_PRIORITY_ACTIVATED: `🚨 *EMERGENCY SOS PRIORITY #1 ACTIVATED!* 🚨

{DoctorName} ke dashboard par aapka case *PRIORITY #1* position par alert ho gaya hai (Red Pulsing Alert 🔴)!

• Emergency Token: *{SosTokenNumber}*
• Doctor: *{DoctorName}*
• Clinic Desk: *{ClinicName}*
• Status: *Chamber Alerted (Top Priority)* 🔴
• Emergency Surcharge: *₹{EmergencyFee}*

Kripya turant clinic emergency desk par pahuchein aur token *{SosTokenNumber}* compounder ko show karein! 🩺`,

  /**
   * Template 7: Book for Family Member (Interactive Family Health Desk)
   */
  FAMILY_HEALTH_DESK: `👥 *FAMILY HEALTH DESK — {ClinicName}* 🏥

Namaste {PatientName}! Apne parivaar ke kisi sadasya ke liye checkup book kijiye:

{FamilyMembersList}
0️⃣ Naye Family Member ko Add Karein ➕

Checkup book karne ke liye member number (ya 0) reply kijiye! 🩺
[ Buttons: ➕ Add New Member | 🏠 Main Menu ]`,

  /**
   * Template 8: Rx Prescription & Doctor Notes Summary
   */
  RX_PRESCRIPTION_SUMMARY: `📋 *PRESCRIPTION & DOCTOR NOTES SUMMARY* 🩺

• Patient: *{PatientName}*
• Doctor: *{DoctorName}*
• Clinic: *{ClinicName}*
• Consultation Date: *{EncounterDate}*

📝 *Doctor's Clinical Notes:*
"{ClinicalNotes}"

💊 *Prescribed Medications Schedule:*
{MedicationsListTable}

📅 *Follow-Up Advice:*
{DoctorName} ne aapko *{FollowUpAdvice}* ke baad follow-up ke liye bulaya hai.

[ Buttons: 💊 1-Click Refill | 🏠 Main Menu ]`,

  /**
   * Template 9: AI Clinical Assistant (24/7 Clinical Guidelines)
   */
  AI_CLINICAL_ASSISTANT: `🤖 *VITALSYNC AI CLINICAL ASSISTANT* 💡

Namaste {PatientName}! Main {DoctorName} ka verified AI Clinical Assistant hoon.

Aap apna health question ya lakshan (symptoms) yahan likh kar bhej sakte hain. Main doctor-approved ICMR clinical guidelines ke anusaar aapko immediate guidance doonga.

⚠️ *Emergency Warning:* Kisi bhi gambhir takleef (chest pain, severe breathlessness, fainting) mein turant Emergency SOS (Reply 'SOS') use karein ya clinic visit karein!

Aapka sawal kya hai? Kripya neeche type kijiye: ✍️`,

  /**
   * Template 10: Digital Health Locker & Medical Records
   */
  DIGITAL_HEALTH_LOCKER: `📁 *DIGITAL HEALTH LOCKER — {ClinicName}* 🔐

Namaste {PatientName}! Aapka ABHA/VitalSync Health Locker secure cloud par active hai:

• Consultations on File: *{TotalEncounters}*
• Pathology Lab Reports: *{TotalReports}*
• Last Prescribed Visit: *{LatestEncounterDate}*
• Latest Pathology Test: *{LatestTestName}* ({LatestTestDate})

📥 *Instant Access:*
• Latest Prescription dekhne ke liye *SUMMARY* reply kijiye
• Latest Lab Report dekhne ke liye *REPORT* reply kijiye

[ Buttons: 📋 Latest Rx | 🔬 Lab Report | 🏠 Main Menu ]`,

  /**
   * Live Queue Turn Alert (2 Patients Ahead)
   */
  QUEUE_TURN_ALERT: `🔔 *CLINIC TURN ALERT — 2 PATIENTS AHEAD!* ⏳

Namaste {PatientName} Ji!

{DoctorName} ke chamber mein aapka token *#{TokenNumber}* jald hi aane wala hai:
• Currently Waiting: *{AheadCount} patient* aapke aage hain.
• Estimated Time: ~*{WaitMinutes} minute*

Kripya clinic OPD waiting area (Desk #1 ke samne) mein ready rahein! 🩺`,

  /**
   * 14-Day Post-Consult Follow-Up Reminder
   */
  FOLLOW_UP_REMINDER: `📅 *DOCTOR FOLLOW-UP REMINDER* 🏥

Namaste {PatientName} Ji! 🙏

{DoctorName} ke sath aapke consult ko 14 din ho chuke hain.
• Follow-up Status: *Due This Week*
• Clinic: {ClinicName}

Tabiyat kaisi hai? Routine follow-up ya reports review ke liye slot book karein:
{AppointmentLink}

[ Buttons: 🏥 Book Follow-up | 💬 Ask Question ]`,

  /**
   * Chronic Patient Interactive Care Desk
   */
  CHRONIC_CARE_DESK: `🩺 *VITALSYNC CHRONIC CARE DESK — {ClinicName}* 🌿

Namaste {PatientName} Ji! 🙏
Aapka chronic health profile active surveillance mein hai:

• Condition: *{ConditionName}*
• Regular Medicine: *{PrimaryMedicine}*
• Remaining Supply: *~{DaysLeft} din baki*
• Next Diagnostic Re-test: *{NextRetestName}* ({NextRetestDate})

Neeche se apna option chuniye:
1️⃣ Confirm 1-Click Refill Pack (10% VIP OFF) 💊
2️⃣ Schedule Doctor Follow-up Review 👨‍⚕️
3️⃣ Book 90-Day Diagnostic Blood Test (Ghar se sample collection) 🔬
4️⃣ Condition-Specific ICMR Diet & Lifestyle Plan 🥗

Reply *1*, *2*, *3* ya *4* to proceed!
[ Buttons: 💊 1-Click Refill | 👨‍⚕️ Doctor Review | 🔬 Book Lab Test ]`,

  /**
   * Chronic Patient Consultation Follow-Up Auto-Scheduling
   */
  CHRONIC_CONSULT_SCHEDULING: `📅 *CHRONIC HEALTH REVIEW — {ClinicName}* 🩺

Namaste {PatientName} Ji! 🙏
{DoctorName} ne aapke *{ConditionName}* ke routine health evaluation ke liye follow-up slot recommend kiya hai.

• Consultation Mode: Physical OPD ya Virtual Video Call
• Doctor Fee: *₹{DoctorFee}*

Slot select karein:
1️⃣ Morning Slot (10:00 AM - 11:30 AM)
2️⃣ Afternoon Slot (02:00 PM - 03:30 PM)
3️⃣ Evening Slot (05:00 PM - 06:30 PM)

Reply *1*, *2*, ya *3* karke slot confirm karein!
[ Buttons: 🌅 Morning Slot | ☀️ Afternoon Slot | 🌆 Evening Slot ]`,

  /**
   * Chronic Patient 90-Day Diagnostic Re-Test Scheduling
   */
  CHRONIC_RETEST_SCHEDULING: `🔬 *90-DAY BIOMARKER RE-TEST ALERT — {ClinicName}* 🩸

Namaste {PatientName} Ji! 🙏
Aapke *{ConditionName}* control ko monitor karne ke liye agla routine checkup test schedule ho gaya hai:

• Advised Panel: *{TestName}*
• Why needed: Organ protection aur dawa ka accurate dosage verify karne ke liye.
• Service: *Ghar Baithe Phlebotomist Sample Collection* 🏠
• Fasting Required: *8 ghante ki fasting*

Collection slot chuniye:
1️⃣ Kal Subah (07:30 AM - 09:00 AM)
2️⃣ Kal Subah (09:00 AM - 10:30 AM)

Reply *1* ya *2* to confirm home sample collection!
[ Buttons: 🏠 Kal 07:30 AM | 🏠 Kal 09:00 AM ]`,

  /**
   * Chronic 1-Click Refill Confirmation & Order Reservation
   */
  CHRONIC_REFILL_CONFIRMATION: `🟢 *CHRONIC 1-CLICK REFILL RESERVED!* 💊

Namaste {PatientName} Ji! 🙏
{ClinicName} Pharmacy counter par aapka 1 Month Refill Pack reserve ho gaya hai:

• Medicine: *{MedicineName}*
• Quantity: *{Quantity}*
• Total Price (10% VIP Discount applied): *₹{DiscountedAmount}*
• Order Token: *{RefillToken}* 📑
• Delivery Mode: *{DeliveryMode}*

Pharmacy counter par token *{RefillToken}* dikha kar dawai le sakte hain ya 24hr home delivery ke liye wait karein. Stay healthy! 😊`
});

// ==========================================
// 2. TYPED PARAMETER CONTRACTS
// ==========================================

export interface WelcomeMenuParams {
  patientPhone: string;
  patientName: string;
  clinicName?: string;
  doctorName?: string;
}

export interface SlotLockedParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  slotTime: string;
  slotDate: string;
  doctorFee: number | string;
  tokenNumber?: string;
  paymentPortalUrl?: string;
}

export interface TokenConfirmedParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  tokenNumber: string;
  aheadCount?: number;
  waitMinutes?: number;
  clinicAddress?: string;
}

export interface LabReportReadyParams {
  patientPhone: string;
  patientName: string;
  testName: string;
  aiSummaryHinglish?: string;
  pdfUrl?: string;
  doctorLastName?: string;
  assignedTime?: string;
}

export interface RefillReminderParams {
  patientPhone: string;
  patientName: string;
  medicineName: string;
  mrpAmount: number | string;
  discountedAmount: number | string;
  clinicName?: string;
  daysLeft?: number;
}

export interface SOSActivatedParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  sosTokenNumber: string;
  emergencyFee?: number | string;
}

export interface FamilyDeskParams {
  patientPhone: string;
  patientName: string;
  clinicName?: string;
  familyMembers: Array<{ name: string; relation?: string; age?: number; gender?: string }>;
}

export interface RxSummaryParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  encounterDate?: string;
  clinicalNotes?: string;
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  followUpAdvice?: string;
}

export interface AIClinicalAssistantParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
}

export interface HealthLockerParams {
  patientPhone: string;
  patientName: string;
  clinicName?: string;
  totalEncounters: number;
  totalReports: number;
  latestEncounterDate?: string;
  latestTestName?: string;
  latestTestDate?: string;
}

export interface QueueAlertParams {
  patientPhone: string;
  patientName: string;
  tokenNumber: string;
  aheadCount: number;
  waitMinutes: number;
  doctorName?: string;
}

export interface FollowUpReminderParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  appointmentLink?: string;
}

export interface ChronicCareDeskParams {
  patientPhone: string;
  patientName: string;
  conditionName?: string;
  primaryMedicine?: string;
  daysLeft?: number;
  nextRetestName?: string;
  nextRetestDate?: string;
  clinicName?: string;
}

export interface ChronicConsultSchedulingParams {
  patientPhone: string;
  patientName: string;
  doctorName?: string;
  conditionName?: string;
  doctorFee?: number | string;
  clinicName?: string;
}

export interface ChronicRetestSchedulingParams {
  patientPhone: string;
  patientName: string;
  conditionName?: string;
  testName?: string;
  clinicName?: string;
}

export interface ChronicRefillConfirmationParams {
  patientPhone: string;
  patientName: string;
  medicineName: string;
  quantity?: string | number;
  discountedAmount: number | string;
  refillToken: string;
  deliveryMode?: string;
  clinicName?: string;
}

// ==========================================
// 3. AGENTIC TEMPLATE ENGINE CLASS
// ==========================================

export class WhatsAppTemplateEngine {
  /**
   * Internal non-blocking dispatch wrapper
   */
  private static async executeDispatch(phone: string, text: string, eventName: string): Promise<boolean> {
    if (!phone || !text) {
      console.warn(`[WhatsAppTemplateEngine] Skipped ${eventName} — phone or text is empty.`);
      return false;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      console.warn(`[WhatsAppTemplateEngine] Invalid target phone for ${eventName}:`, phone);
      return false;
    }

    // Fire non-blocking promise so UI caller never blocks
    return new Promise((resolve) => {
      Promise.resolve().then(async () => {
        try {
          WhatsAppService.pushWhatsAppMessageFromBot(cleanPhone, text);
          console.log(`[WhatsAppTemplateEngine] ✅ Dispatched ${eventName} to +91 ${cleanPhone}`);
          resolve(true);
        } catch (err) {
          console.error(`[WhatsAppTemplateEngine] Failed to dispatch ${eventName}:`, err);
          resolve(false);
        }
      });
    });
  }

  /**
   * T1: Welcome Menu Dispatch
   */
  public static async dispatchWelcomeMenu(params: WelcomeMenuParams): Promise<boolean> {
    const clinic = params.clinicName || 'VitalSync Smart Clinic';
    const msg = CANONICAL_WHATSAPP_TEMPLATES.WELCOME_MENU
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{ClinicName\}/g, clinic)
      .replace(/\{CLINIC_NAME\}/g, clinic.toUpperCase());

    return this.executeDispatch(params.patientPhone, msg, 'T1_WELCOME_MENU');
  }

  /**
   * T2: Slot Locked & Payment Gate Dispatch
   */
  public static async dispatchSlotLocked(params: SlotLockedParams): Promise<boolean> {
    const fee = typeof params.doctorFee === 'number' ? params.doctorFee.toFixed(2) : params.doctorFee;
    const msg = CANONICAL_WHATSAPP_TEMPLATES.SLOT_LOCKED
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar')
      .replace(/\{SlotTime\}/g, params.slotTime || '10:00 AM')
      .replace(/\{SlotDate\}/g, params.slotDate || 'Today')
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Clinic')
      .replace(/\{DoctorFee\}/g, String(fee || '500.00'))
      .replace(/\{TokenNumber\}/g, params.tokenNumber || 'TK-01')
      .replace(/\{PaymentPortalUrl\}/g, params.paymentPortalUrl || 'https://app.vitalsync.in/pay');

    return this.executeDispatch(params.patientPhone, msg, 'T2_SLOT_LOCKED');
  }

  /**
   * T3: Token Confirmed & Live Queue Issue
   */
  public static async dispatchTokenConfirmed(params: TokenConfirmedParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.TOKEN_CONFIRMED
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar')
      .replace(/\{TokenNumber\}/g, params.tokenNumber)
      .replace(/\{AheadCount\}/g, String(params.aheadCount ?? 3))
      .replace(/\{WaitMinutes\}/g, String(params.waitMinutes ?? 20))
      .replace(/\{ClinicAddress\}/g, params.clinicAddress || 'Main Road, Clinic Center');

    return this.executeDispatch(params.patientPhone, msg, 'T3_TOKEN_CONFIRMED');
  }

  /**
   * T4: Lab Report Delivery & 2-Button Review Loop
   */
  public static async dispatchLabReportReady(params: LabReportReadyParams): Promise<boolean> {
    const pdfLine = params.pdfUrl ? `📎 Download PDF: ${params.pdfUrl}` : '📎 Download PDF via Health Locker';
    const msg = CANONICAL_WHATSAPP_TEMPLATES.LAB_REPORT_READY
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{TestName\}/g, params.testName || 'Comprehensive Health Panel')
      .replace(/\{AiSummaryHinglish\}/g, params.aiSummaryHinglish || 'Aapke sabhi reports normal range mein hain.')
      .replace(/\{AssignedTime\}/g, params.assignedTime || '05:00 PM')
      .replace(/\{PdfDownloadUrl\}/g, pdfLine)
      .replace(/\{DoctorLastName\}/g, params.doctorLastName || 'Kumar');

    return this.executeDispatch(params.patientPhone, msg, 'T4_LAB_REPORT_READY');
  }

  /**
   * T5: Day-25 Automated Chronic Medicine Refill Reminder
   */
  public static async dispatchRefillReminder(params: RefillReminderParams): Promise<boolean> {
    const mrp = typeof params.mrpAmount === 'number' ? params.mrpAmount.toFixed(2) : params.mrpAmount;
    const disc = typeof params.discountedAmount === 'number' ? params.discountedAmount.toFixed(2) : params.discountedAmount;

    const msg = CANONICAL_WHATSAPP_TEMPLATES.CHRONIC_REFILL_REMINDER
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{MedicineName\}/g, params.medicineName || 'Prescribed Medicine')
      .replace(/\{DaysLeft\}/g, String(params.daysLeft ?? 5))
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync')
      .replace(/\{MrpAmount\}/g, String(mrp || '550.00'))
      .replace(/\{DiscountedAmount\}/g, String(disc || '495.00'));

    return this.executeDispatch(params.patientPhone, msg, 'T5_CHRONIC_REFILL');
  }

  /**
   * T6: Emergency SOS Priority #1 Routing
   */
  public static async dispatchSOSActivated(params: SOSActivatedParams): Promise<boolean> {
    const fee = typeof params.emergencyFee === 'number' ? params.emergencyFee.toFixed(2) : params.emergencyFee;
    const msg = CANONICAL_WHATSAPP_TEMPLATES.SOS_PRIORITY_ACTIVATED
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar')
      .replace(/\{SosTokenNumber\}/g, params.sosTokenNumber)
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Emergency Desk')
      .replace(/\{EmergencyFee\}/g, String(fee || '618.00'));

    return this.executeDispatch(params.patientPhone, msg, 'T6_SOS_ACTIVATED');
  }

  /**
   * T7: Family Health Desk Selection
   */
  public static async dispatchFamilyDesk(params: FamilyDeskParams): Promise<boolean> {
    const membersList = (params.familyMembers || [])
      .map((m, idx) => `${idx + 1}️⃣ ${m.name} (${m.relation || 'Member'}${m.age ? `, ${m.age}y` : ''})`)
      .join('\n');

    const msg = CANONICAL_WHATSAPP_TEMPLATES.FAMILY_HEALTH_DESK
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync')
      .replace(/\{PatientName\}/g, params.patientName || 'Family Head')
      .replace(/\{FamilyMembersList\}/g, membersList ? `${membersList}\n` : 'Aapke account mein koi member added nahi hai.\n');

    return this.executeDispatch(params.patientPhone, msg, 'T7_FAMILY_HEALTH_DESK');
  }

  /**
   * T8: Rx Prescription & Doctor Notes Summary
   */
  public static async dispatchRxSummary(params: RxSummaryParams): Promise<boolean> {
    const medRows = (params.medications || [])
      .map((m, idx) => `${idx + 1}. 💊 *${m.name}* — ${m.frequency || '1-0-1'} (${m.duration || '10 Days'})\n   Advice: ${m.instructions || m.dosage || 'Take after meals'}`)
      .join('\n\n');

    const msg = CANONICAL_WHATSAPP_TEMPLATES.RX_PRESCRIPTION_SUMMARY
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar')
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Clinic')
      .replace(/\{EncounterDate\}/g, params.encounterDate || new Date().toLocaleDateString('en-IN'))
      .replace(/\{ClinicalNotes\}/g, params.clinicalNotes || 'Follow prescribed lifestyle & medication regimen.')
      .replace(/\{MedicationsListTable\}/g, medRows || 'No oral medicines prescribed.')
      .replace(/\{FollowUpAdvice\}/g, params.followUpAdvice || '14 din');

    return this.executeDispatch(params.patientPhone, msg, 'T8_RX_SUMMARY');
  }

  /**
   * T9: AI Clinical Assistant Initial Contact
   */
  public static async dispatchAIClinicalAssistant(params: AIClinicalAssistantParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.AI_CLINICAL_ASSISTANT
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar');

    return this.executeDispatch(params.patientPhone, msg, 'T9_AI_ASSISTANT');
  }

  /**
   * T10: Digital Health Locker Overview
   */
  public static async dispatchHealthLocker(params: HealthLockerParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.DIGITAL_HEALTH_LOCKER
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync')
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{TotalEncounters\}/g, String(params.totalEncounters || 0))
      .replace(/\{TotalReports\}/g, String(params.totalReports || 0))
      .replace(/\{LatestEncounterDate\}/g, params.latestEncounterDate || 'N/A')
      .replace(/\{LatestTestName\}/g, params.latestTestName || 'Routine Panel')
      .replace(/\{LatestTestDate\}/g, params.latestTestDate || 'Recent');

    return this.executeDispatch(params.patientPhone, msg, 'T10_HEALTH_LOCKER');
  }

  /**
   * Queue Alert (2 Patients Ahead)
   */
  public static async dispatchQueueAlert(params: QueueAlertParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.QUEUE_TURN_ALERT
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Doctor')
      .replace(/\{TokenNumber\}/g, params.tokenNumber)
      .replace(/\{AheadCount\}/g, String(params.aheadCount))
      .replace(/\{WaitMinutes\}/g, String(params.waitMinutes));

    return this.executeDispatch(params.patientPhone, msg, 'QUEUE_TURN_ALERT');
  }

  /**
   * Follow-up Reminder (14 Days)
   */
  public static async dispatchFollowUpReminder(params: FollowUpReminderParams): Promise<boolean> {
    const link = params.appointmentLink || 'https://app.vitalsync.in/book';
    const msg = CANONICAL_WHATSAPP_TEMPLATES.FOLLOW_UP_REMINDER
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Doctor')
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Clinic')
      .replace(/\{AppointmentLink\}/g, link);

    return this.executeDispatch(params.patientPhone, msg, 'FOLLOW_UP_REMINDER');
  }

  /**
   * Chronic Care Desk Dispatch
   */
  public static async dispatchChronicCareDesk(params: ChronicCareDeskParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.CHRONIC_CARE_DESK
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Smart Clinic')
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{ConditionName\}/g, params.conditionName || 'Chronic Condition')
      .replace(/\{PrimaryMedicine\}/g, params.primaryMedicine || 'Prescribed Regimen')
      .replace(/\{DaysLeft\}/g, String(params.daysLeft ?? 5))
      .replace(/\{NextRetestName\}/g, params.nextRetestName || 'Routine Biomarker Panel')
      .replace(/\{NextRetestDate\}/g, params.nextRetestDate || 'Due Soon');

    return this.executeDispatch(params.patientPhone, msg, 'CHRONIC_CARE_DESK');
  }

  /**
   * Chronic Follow-Up Consult Scheduling Dispatch
   */
  public static async dispatchChronicConsultScheduling(params: ChronicConsultSchedulingParams): Promise<boolean> {
    const fee = typeof params.doctorFee === 'number' ? params.doctorFee.toFixed(2) : params.doctorFee;
    const msg = CANONICAL_WHATSAPP_TEMPLATES.CHRONIC_CONSULT_SCHEDULING
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Clinic')
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{DoctorName\}/g, params.doctorName || 'Dr. Pankaj Kumar')
      .replace(/\{ConditionName\}/g, params.conditionName || 'Chronic Care')
      .replace(/\{DoctorFee\}/g, String(fee || '500.00'));

    return this.executeDispatch(params.patientPhone, msg, 'CHRONIC_CONSULT_SCHEDULING');
  }

  /**
   * Chronic 90-Day Diagnostic Re-Test Scheduling Dispatch
   */
  public static async dispatchChronicRetestInvitation(params: ChronicRetestSchedulingParams): Promise<boolean> {
    const msg = CANONICAL_WHATSAPP_TEMPLATES.CHRONIC_RETEST_SCHEDULING
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync Diagnostics')
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{ConditionName\}/g, params.conditionName || 'Health')
      .replace(/\{TestName\}/g, params.testName || 'Comprehensive Chronic Biomarker Panel');

    return this.executeDispatch(params.patientPhone, msg, 'CHRONIC_RETEST_SCHEDULING');
  }

  /**
   * Chronic 1-Click Refill Confirmation Dispatch
   */
  public static async dispatchChronicRefillConfirmation(params: ChronicRefillConfirmationParams): Promise<boolean> {
    const disc = typeof params.discountedAmount === 'number' ? params.discountedAmount.toFixed(2) : params.discountedAmount;
    const msg = CANONICAL_WHATSAPP_TEMPLATES.CHRONIC_REFILL_CONFIRMATION
      .replace(/\{ClinicName\}/g, params.clinicName || 'VitalSync')
      .replace(/\{PatientName\}/g, params.patientName || 'Patient')
      .replace(/\{MedicineName\}/g, params.medicineName)
      .replace(/\{Quantity\}/g, String(params.quantity || '1 Month Pack (30 tabs)'))
      .replace(/\{DiscountedAmount\}/g, String(disc || '495.00'))
      .replace(/\{RefillToken\}/g, params.refillToken)
      .replace(/\{DeliveryMode\}/g, params.deliveryMode || 'Free Clinic Counter Pickup ya 24hr Home Delivery');

    return this.executeDispatch(params.patientPhone, msg, 'CHRONIC_REFILL_CONFIRMATION');
  }
}
