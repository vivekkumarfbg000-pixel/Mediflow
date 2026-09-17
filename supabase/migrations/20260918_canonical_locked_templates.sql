-- ═══════════════════════════════════════════════════════════════════════════════
-- VITALSYNC CANONICAL WHATSAPP TEMPLATES — PERMANENT LOCKED STORAGE & IMMUTABILITY
-- File: 20260918_canonical_locked_templates.sql
-- All statements are strictly idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create canonical_templates table
CREATE TABLE IF NOT EXISTS public.canonical_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT DEFAULT 'UTILITY',
  language TEXT DEFAULT 'hinglish',
  title TEXT NOT NULL,
  template_body TEXT NOT NULL,
  components JSONB DEFAULT '[]'::jsonb,
  buttons JSONB DEFAULT '[]'::jsonb,
  is_locked BOOLEAN DEFAULT TRUE,
  locked_by TEXT DEFAULT 'ADMIN_GOVERNANCE',
  permission_required TEXT DEFAULT 'SUPABASE_ADMIN_ONLY',
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.canonical_templates IS 'Permanent, immutable storage for canonical WhatsApp message templates under Admin Governance.';
COMMENT ON COLUMN public.canonical_templates.is_locked IS 'When TRUE, this template cannot be modified or deleted without explicit admin permission.';

-- 2. Row Level Security: Public read, Service Role write only
ALTER TABLE public.canonical_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canonical_templates_read_all" ON public.canonical_templates;
CREATE POLICY "canonical_templates_read_all"
  ON public.canonical_templates FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "canonical_templates_service_write" ON public.canonical_templates;
CREATE POLICY "canonical_templates_service_write"
  ON public.canonical_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Immutability Trigger: Prohibit modification of locked templates
CREATE OR REPLACE FUNCTION public.prevent_locked_template_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = TRUE AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'PERMISSION DENIED: Template "%" is permanently locked under Admin Governance and cannot be modified without explicit permission.', OLD.template_key;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_template_modification ON public.canonical_templates;
CREATE TRIGGER trg_prevent_locked_template_modification
  BEFORE UPDATE OR DELETE ON public.canonical_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_template_modification();

-- 4. Seed all 12 Canonical WhatsApp Templates permanently
INSERT INTO public.canonical_templates (template_key, template_name, category, language, title, template_body, buttons, is_locked)
VALUES
(
  'welcome_onboard',
  'patient_onboarding_welcome',
  'UTILITY',
  'hinglish',
  'New Patient Onboarding Welcome',
  'Namaste {PatientName}! 🙏 {ClinicName} mein aapka swagat hai!

Aapka registration safaltapoorvak complete ho gaya hai. VitalSync Smart Clinic ecosystem ke saath aapko milti hain ye premium suvidhayein:

1️⃣ 1 Free Virtual Consult (15-20 dinon ke bheetar) 🆓
2️⃣ 10% Discount on Medicine Refills 💊
3️⃣ Daily WhatsApp Reminders & Health Updates 📱
4️⃣ Instant Digital Lab Reports & Prescriptions 📄

Kisi bhi sahayata ke liye yahan message karein! Swasth rahein, surakshit rahein! 🩺✨',
  '["🏥 Book Visit", "💊 1-Click Refill", "🚨 Emergency SOS"]'::jsonb,
  TRUE
),
(
  'main_welcome_menu',
  'main_welcome_menu_template',
  'UTILITY',
  'hinglish',
  'Template 1: Main Welcome Menu (6 Core Services)',
  'Namaste {PatientName}! 🙏 Welcome to {ClinicName}.

🌟 {CLINIC_NAME} SERVICES 🌟
1️⃣ Book Physical Clinic Visit 🏥
2️⃣ Book Virtual Video Consult 💻 (1 Free Consult Unlocked)
3️⃣ View Lab Reports & Hinglish Summary 🔬
4️⃣ Emergency SOS Priority #1 Routing 🚨
5️⃣ 1-Click Medicine Refill (10% OFF) 💊
6️⃣ Refer a Patient & Earn 10% OFF 🎁

Service select karne ke liye button tap kijiye ya number (1-6) reply kijiye! 🩺',
  '["🏥 Book Physical Visit", "💻 Book Virtual Video", "🚨 Emergency SOS"]'::jsonb,
  TRUE
),
(
  'appointment_slot_locked',
  'appointment_slot_locked_template',
  'UTILITY',
  'hinglish',
  'Template 2: Checkup Slot Selection & Locked State',
  '📅 *Checkup Slot Selected!*

{DoctorName} ke liye checkup slot *{SlotTime}* ({SlotDate}) at {ClinicName} lock kar diya gaya hai.

• Doctor Consultation Fee: *₹{DoctorFee}*

📱 *Doctor Direct UPI Se Pay Karein ya Portal Link Se:*
{PaymentPortalUrl}

Payment complete hone ke baad please *PAY* reply kijiye ya *[ I Have Paid ✅ ]* button tap kijiye! Turant token {TokenNumber} issue ho jayega 📑',
  '["I Have Paid ✅", "Pay via Direct UPI 💳"]'::jsonb,
  TRUE
),
(
  'appointment_confirmed',
  'appointment_confirmed_template',
  'UTILITY',
  'hinglish',
  'Template 3: Payment Cleared & Instant Sequential Token Issue',
  '🟢 *APPOINTMENT CONFIRMED & TOKEN ALLOCATED!*

Hi {PatientName}! {DoctorName} ke saath aapka checkup confirm ho gaya hai:

• Token Number: *{TokenNumber}* 🎫
• Queue Status: {AheadCount} Patients ahead of you (~{WaitMinutes} mins wait)
• Live Clinic Turn Alert: Turn aane se 2 patient pehle WhatsApp alert aayega!
• Clinic Location: {ClinicAddress}, Desk #1

Doctor EMR aur Compounder Desk par aapki entry live sync ho chuki hai. Thank you! 😊',
  '["📍 Directions", "📞 Call Clinic"]'::jsonb,
  TRUE
),
(
  'lab_report_ready',
  'lab_report_ready_template',
  'UTILITY',
  'hinglish',
  'Template 4: Lab Report Delivery & 2-Button Review Loop',
  '📄 *Aapki Pathology Report Taiyar Hai!* 🔬

• Patient: {PatientName}
• Test: {TestName}
• Status: Verified & Approved 🟢
• AI Clinical Summary: {AiSummaryHinglish}

📥 [ 📎 Download Full Lab Report PDF ]

Dr. {DoctorLastName} se report review ke liye option chuniye:
(Physical Review chune par aapki prescribed dawaiyan clinic pharmacy counter par reserve ho jayengi).',
  '["🏥 Physical Review at Clinic", "💻 Virtual Video Review"]'::jsonb,
  TRUE
),
(
  'chronic_refill_reminder',
  'chronic_refill_reminder_template',
  'UTILITY',
  'hinglish',
  'Template 5: Day-25 Automated Chronic Medicine Refill (10% OFF VIP)',
  'Namaste {PatientName} Ji! 🩺
Aapki *{MedicineName}* dawa agle *5 dino mein khatam* hone wali hai.

Blood pressure/sugar control mein gap na aaye, isliye {ClinicName} Pharmacy ne aapka *1 Month Refill Pack (10% OFF)* ready rakha hai:

• MRP: ~₹{MrpAmount}~
• Your Price (10% VIP Discount): *₹{DiscountedAmount}*
• Delivery: Free Clinic Counter Pickup ya 24hr Home Delivery',
  '["📦 Confirm 1-Click Refill", "👨‍⚕️ Speak to Doctor"]'::jsonb,
  TRUE
),
(
  'emergency_sos_priority',
  'emergency_sos_priority_template',
  'UTILITY',
  'hinglish',
  'Template 6: Emergency SOS Priority #1 Routing',
  '🚨 *EMERGENCY SOS PRIORITY #1 ACTIVATED!* 🚨

{DoctorName} ke dashboard par aapka case *PRIORITY #1* position par alert ho gaya hai (Red Pulsing Alert 🔴)!

• Emergency Token: *{SosTokenNumber}*
• Doctor: *{DoctorName}*
• Clinic Desk: *{ClinicName}*
• Status: *Chamber Alerted (Top Priority)* 🔴
• Emergency Surcharge: *₹{EmergencyFee}*

Kripya turant clinic emergency desk par pahuchein aur token *{SosTokenNumber}* compounder ko show karein! 🩺',
  '["🚨 Emergency Desk", "📞 Call Doctor Now"]'::jsonb,
  TRUE
),
(
  'family_health_desk',
  'family_health_desk_template',
  'UTILITY',
  'hinglish',
  'Template 7: Book for Family Member (Family Health Desk)',
  '👥 *FAMILY HEALTH DESK — {ClinicName}* 🏥

Namaste {PatientName}! Apne parivaar ke kisi sadasya ke liye checkup book kijiye:

{FamilyMembersList}
0️⃣ Naye Family Member ko Add Karein ➕

Checkup book karne ke liye member number (ya 0) reply kijiye! 🩺',
  '["➕ Add New Member", "🏠 Main Menu"]'::jsonb,
  TRUE
),
(
  'prescription_summary',
  'prescription_summary_template',
  'UTILITY',
  'hinglish',
  'Template 8: Rx Prescription & Doctor Notes Summary',
  '📋 *PRESCRIPTION & DOCTOR NOTES SUMMARY* 🩺

• Patient: *{PatientName}*
• Doctor: *{DoctorName}*
• Clinic: *{ClinicName}*
• Consultation Date: *{EncounterDate}*

📝 *Doctor''s Clinical Notes:*
"{ClinicalNotes}"

💊 *Prescribed Medications Schedule:*
{MedicationsListTable}

📅 *Follow-Up Advice:*
{DoctorName} ne aapko *14 din* ke baad follow-up ke liye bulaya hai.',
  '["💊 1-Click Refill", "🏠 Main Menu"]'::jsonb,
  TRUE
),
(
  'ai_clinical_assistant',
  'ai_clinical_assistant_template',
  'UTILITY',
  'hinglish',
  'Template 9: AI Clinical Assistant (24/7 Guidelines)',
  '🤖 *VITALSYNC AI CLINICAL ASSISTANT* 💡

Namaste {PatientName}! Main {DoctorName} ka verified AI Clinical Assistant hoon.

Aap apna health question ya lakshan (symptoms) yahan likh kar bhej sakte hain. Main doctor-approved ICMR clinical guidelines ke anusaar aapko immediate guidance doonga.

⚠️ *Emergency Warning:* Kisi bhi gambhir takleef (chest pain, severe breathlessness, fainting) mein turant Emergency SOS (Reply ''SOS'') use karein ya clinic visit karein!

Aapka sawal kya hai? Kripya neeche type kijiye: ✍️',
  '["🚨 Emergency SOS", "🏠 Main Menu"]'::jsonb,
  TRUE
),
(
  'digital_health_locker',
  'digital_health_locker_template',
  'UTILITY',
  'hinglish',
  'Template 10: Digital Health Locker & Medical Records',
  '📁 *DIGITAL HEALTH LOCKER — {ClinicName}* 🔐

Namaste {PatientName}! Aapka ABHA/VitalSync Health Locker secure cloud par active hai:

• Consultations on File: *{TotalEncounters}*
• Pathology Lab Reports: *{TotalReports}*
• Last Prescribed Visit: *{LatestEncounterDate}*
• Latest Pathology Test: *{LatestTestName}* ({LatestTestDate})

📥 *Instant Access:*
• Latest Prescription dekhne ke liye *SUMMARY* reply kijiye
• Latest Lab Report dekhne ke liye *REPORT* reply kijiye',
  '["📋 Latest Rx", "🔬 Lab Report", "🏠 Main Menu"]'::jsonb,
  TRUE
),
(
  'payment_receipt',
  'payment_receipt_template',
  'UTILITY',
  'hinglish',
  'Payment Receipt Confirmation',
  'Namaste {PatientName}! Aapka payment of ₹{Amount} successful raha for Invoice #{InvoiceNumber}. VitalSync healthcare app checkup slots configure ho rahe hain. We look forward to serving you! 🟢',
  '["📄 View Receipt", "🏠 Main Menu"]'::jsonb,
  TRUE
)
ON CONFLICT (template_key) DO UPDATE
  SET updated_at = NOW()
  WHERE canonical_templates.is_locked = FALSE;

-- 5. Index for sub-millisecond key lookups
CREATE INDEX IF NOT EXISTS idx_canonical_templates_key ON public.canonical_templates (template_key);
CREATE INDEX IF NOT EXISTS idx_canonical_templates_locked ON public.canonical_templates (is_locked);
