import { supabase } from '../lib/supabaseClient';
import { WhatsAppService } from './whatsappService';
import { safeGetStorageJSON, safeSetStorageJSON } from '../utils/storage';

export interface AccountCreatedNotificationPayload {
  doctorName: string;
  clinicName: string;
  phone: string;
  email?: string;
  clinicCode: string;
  specialization?: string;
  city?: string;
  source?: 'doctor_registration_modal' | 'auth_gateway_signup' | 'api';
}

export const FOUNDER_PHONE = '919608032073'; // +91-9608032073
export const FOUNDER_EMAIL = 'vivek@vitalsync.in';

export class FounderNotificationService {
  /**
   * Dispatches instantaneous real-time notifications to the Founder's personal WhatsApp
   * and cloud webhook/email pipeline whenever a doctor or clinic account is created.
   */
  static async notifyOnAccountCreated(payload: AccountCreatedNotificationPayload): Promise<void> {
    const {
      doctorName,
      clinicName,
      phone,
      email,
      clinicCode,
      specialization,
      city,
      source = 'auth_gateway_signup'
    } = payload;

    const formattedTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const cleanDoctorPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const cleanSpec = specialization || 'General Practice';
    const cleanCity = city || 'Line Bazar, Purnea';

    // ── 1. Format Outbound WhatsApp Alert for Founder ─────────────────────────
    const whatsappMessage = 
`🔔 *VitalSync Founder Alert: New Doctor Onboarded!* 🏥

👨‍⚕️ *Doctor:* Dr. ${doctorName}
🏥 *Clinic:* ${clinicName}
📱 *Doctor Phone:* +91 ${cleanDoctorPhone}
${email ? `📧 *Doctor Email:* ${email}\n` : ''}🏷️ *Clinic Code:* ${clinicCode}
🩺 *Specialization:* ${cleanSpec}
📍 *Location:* ${cleanCity}
⏰ *Time:* ${formattedTime}
🚀 *Source:* ${source}

👉 Open SaaS Admin Radar: https://app.vitalsync.in`;

    // ── 2. Dispatch WhatsApp Alert to Founder's Phone (+91-9608032073) ────────
    try {
      console.log(`[FounderNotification] Dispatching instant WhatsApp alert to Founder (${FOUNDER_PHONE})...`);
      WhatsAppService.sendWhatsAppMessagePayload(
        FOUNDER_PHONE,
        'mediflow_conversational_reply',
        { replyText: whatsappMessage }
      ).catch(err => {
        console.warn('[FounderNotification] WhatsApp direct dispatch notice:', err);
      });
    } catch (waErr) {
      console.warn('[FounderNotification] WhatsApp outbound queue notice:', waErr);
    }

    // ── 3. Dual-Write to Cloud Telemetry & Trigger Edge Function Webhook ───────
    try {
      await supabase.from('system_health_telemetry').insert([{
        id: crypto.randomUUID(),
        subsystem: 'founder_lead_radar',
        severity: 'info',
        error_code: 'NEW_DOCTOR_ONBOARDED',
        error_stack: JSON.stringify({
          founder_target_phone: FOUNDER_PHONE,
          founder_target_email: FOUNDER_EMAIL,
          doctor_name: doctorName,
          clinic_name: clinicName,
          doctor_phone: cleanDoctorPhone,
          doctor_email: email || null,
          clinic_code: clinicCode,
          specialization: cleanSpec,
          city: cleanCity,
          source: source,
          timestamp: new Date().toISOString()
        }),
        healing_attempts: 0,
        status: 'alerted',
        created_at: new Date().toISOString()
      }]);
    } catch (dbErr) {
      console.warn('[FounderNotification] Remote telemetry dual-write notice:', dbErr);
    }

    // ── 4. Log to Local Founder Alerts Radar & Dispatch UI Event ──────────────
    try {
      if (typeof window !== 'undefined') {
        const existing = safeGetStorageJSON<any[]>('founder_alerts', []);
        const newAlert = {
          id: `alert-signup-${Date.now()}`,
          type: 'new_doctor_signup',
          title: `New Doctor Onboarded: Dr. ${doctorName}`,
          description: `${clinicName} (${clinicCode}) - ${cleanCity}`,
          phone: cleanDoctorPhone,
          timestamp: new Date().toISOString(),
          read: false
        };
        safeSetStorageJSON('founder_alerts', [newAlert, ...existing.slice(0, 25)]);

        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'New Doctor Registered! 👨‍⚕️',
            message: `Dr. ${doctorName} created an account for ${clinicName} (${clinicCode}).`,
            type: 'success'
          }
        }));

        window.dispatchEvent(new CustomEvent('mediflow-founder-alert', { detail: newAlert }));
      }
    } catch (_localErr) {
      /* ignore */
    }
  }
}
