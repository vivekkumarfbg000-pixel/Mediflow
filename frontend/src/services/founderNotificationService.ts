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
    const cleanCity = city || 'Patna, Bihar';

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

  /**
   * Dispatches a real-time WhatsApp + telemetry alert to the Founder whenever a
   * doctor or partner submits the "Book a 1-on-1 Live Demo" form on the landing page.
   * The founder's personal phone number is NEVER exposed in public client-side code.
   */
  static async notifyOnDemoRequested(payload: DemoRequestNotificationPayload): Promise<void> {
    const {
      doctorName,
      clinicName,
      phone,
      specialty,
      patientsVolume,
      preferredTime,
      city,
    } = payload;

    const formattedTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const cleanDoctorPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const cleanCity = city || 'Patna, Bihar';
    const refCode = `DEMO-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    // ── 1. Format Outbound WhatsApp Alert for Founder ─────────────────────────
    const whatsappMessage =
`📅 *VitalSync Demo Request — Deployment Desk Alert!* 🏥

👨‍⚕️ *Clinician:* ${doctorName || 'Not provided'}
🏥 *Clinic/Org:* ${clinicName || 'Not provided'}
📱 *WhatsApp:* +91 ${cleanDoctorPhone}
🩺 *Specialty:* ${specialty || 'General Practice'}
👥 *Daily OPD:* ${patientsVolume || 'Not specified'}
📅 *Preferred Slot:* ${preferredTime || 'Not specified'}
📍 *City:* ${cleanCity}
🔖 *Ref:* ${refCode}
⏰ *Submitted:* ${formattedTime}

👉 Follow up within 2 hours to confirm demo appointment.`;

    // ── 2. Dispatch WhatsApp Alert to Founder ────────────────────────────────
    try {
      console.log(`[FounderNotification] Dispatching demo request alert to Founder (${FOUNDER_PHONE})...`);
      WhatsAppService.sendWhatsAppMessagePayload(
        FOUNDER_PHONE,
        'mediflow_conversational_reply',
        { replyText: whatsappMessage }
      ).catch(err => {
        console.warn('[FounderNotification] Demo WA dispatch notice:', err);
      });
    } catch (waErr) {
      console.warn('[FounderNotification] Demo WA outbound queue notice:', waErr);
    }

    // ── 2b. Dispatch WhatsApp Confirmation to Doctor ─────────────────────────
    if (cleanDoctorPhone) {
      const doctorMessage = `Namaste ${doctorName ? `Dr. ${doctorName}` : 'Doctor'}! 🙏\n\nThank you for booking a Live Demo with VitalSync.\n\nYour request for ${preferredTime || 'soon'} has been received. Our Deployment Desk will connect with you shortly to confirm the slot.\n\nRef: ${refCode}`;
      try {
        console.log(`[FounderNotification] Dispatching demo confirmation to Doctor (${cleanDoctorPhone})...`);
        WhatsAppService.sendWhatsAppMessagePayload(
          `91${cleanDoctorPhone}`,
          'mediflow_conversational_reply',
          { replyText: doctorMessage }
        ).catch(err => {
          console.warn('[FounderNotification] Doctor confirmation WA dispatch notice:', err);
        });
      } catch (waErr) {
        console.warn('[FounderNotification] Doctor WA outbound queue notice:', waErr);
      }
    }

    // ── 3. Dual-Write to Cloud Telemetry ────────────────────────────────────
    try {
      await supabase.from('system_health_telemetry').insert([{
        id: crypto.randomUUID(),
        subsystem: 'founder_lead_radar',
        severity: 'info',
        error_code: 'NEW_DEMO_REQUESTED',
        error_stack: JSON.stringify({
          founder_target_phone: FOUNDER_PHONE,
          founder_target_email: FOUNDER_EMAIL,
          doctor_name: doctorName || null,
          clinic_name: clinicName || null,
          doctor_phone: cleanDoctorPhone,
          specialty: specialty || null,
          patients_volume: patientsVolume || null,
          preferred_time: preferredTime || null,
          city: cleanCity,
          ref_code: refCode,
          timestamp: new Date().toISOString()
        }),
        healing_attempts: 0,
        status: 'alerted',
        created_at: new Date().toISOString()
      }]);
    } catch (dbErr) {
      console.warn('[FounderNotification] Demo telemetry dual-write notice:', dbErr);
    }

    // ── 4. Log to Local Founder Alerts Radar & Escalation Tickets ─────────────
    try {
      if (typeof window !== 'undefined') {
        const existing = safeGetStorageJSON<any[]>('founder_alerts', []);
        const newAlert = {
          id: `alert-demo-${Date.now()}`,
          type: 'new_demo_request',
          title: `Demo Requested: ${doctorName || 'Anonymous'} (${refCode})`,
          description: `${clinicName || 'Clinic'} · ${specialty || 'General'} · ${cleanCity}`,
          phone: cleanDoctorPhone,
          timestamp: new Date().toISOString(),
          read: false
        };
        safeSetStorageJSON('founder_alerts', [newAlert, ...existing.slice(0, 25)]);
        window.dispatchEvent(new CustomEvent('mediflow-founder-alert', { detail: newAlert }));
        
        // Push as a High-Priority Lead to SaaS Admin Support Tickets Dashboard
        import('./whatsappSupportBotService').then(({ WhatsAppSupportBotService }) => {
          WhatsAppSupportBotService.logEscalationTicket({
            clinic_name: clinicName || 'New Lead',
            doctor_name: doctorName || 'Anonymous Doctor',
            sender_role: 'doctor',
            query_text: `Demo Requested\nSpecialty: ${specialty || 'General'}\nPatients: ${patientsVolume || 'N/A'}\nTime: ${preferredTime || 'N/A'}`,
            category: 'sales_lead' as any,
            status: 'open',
            pod_id: 'SYSTEM',
            phone: cleanDoctorPhone || FOUNDER_PHONE
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch (_localErr) {
      /* ignore */
    }
  }
}

export interface DemoRequestNotificationPayload {
  doctorName: string;
  clinicName?: string;
  phone: string;
  specialty?: string;
  patientsVolume?: string;
  preferredTime?: string;
  city?: string;
}
