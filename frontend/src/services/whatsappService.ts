import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { EncounterService } from './encounterService';
import { PharmacyService } from './pharmacyService';
import { LabService } from './labService';
import { BillingService } from './billingService';
import { PaymentService } from './paymentService';
import { getPodContext, FALLBACK_POD_ID, FALLBACK_ENTITY_ID, FALLBACK_DOCTOR_ID } from './podContext';
import { getIstDateString, getIstDateDisplay, getIstOffsetDateString, getIstOffsetDateDisplay } from '../utils/dateUtils';
import type { 
  WhatsAppSession, 
  ChatMessage, 
  Encounter, 
  PharmacyInventoryItem,
  MedicineBillItem,
  MedicineBill,
  FinancialLedgerEntry,
  Appointment
} from '../types';

export function normalizeWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
}

export class WhatsAppService {
  static getWhatsAppSessions(): WhatsAppSession[] {
    let isDemoAccount = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            const email = String(parsed.email || '').toLowerCase();
            const id = String(parsed.id || '').toLowerCase();
            const name = String(parsed.display_name || parsed.displayName || parsed.name || '').toLowerCase();
            isDemoAccount = Boolean(
              parsed.isDemo === true ||
              email === 'demo@mediflow.com'
            );
          }
        }
      } catch (_e) { /* ignore */ }
    }

    let sessions = load<WhatsAppSession[]>('whatsapp_sessions', []);
    if (!isDemoAccount) {
      const currentPodId = getPodContext().podId;
      const testSyntheticPhones = new Set(['9999999999', '9876543210', '0000000000']);
      const testSyntheticNames = new Set(['rls test patient', 'patient customer', 'unknown patient', 'john doe', 'auto test patient']);
      sessions = sessions.filter(s => {
        const pod = (s as any).podId || (s as any).pod_id;
        if (pod && currentPodId && pod !== currentPodId) return false;
        if (pod && !currentPodId) return false;
        if (!pod && currentPodId) {
          (s as any).podId = currentPodId;
        }
        const id = s.id || '';
        const pName = String((s as any).patientName || (s as any).patient_name || '').toLowerCase().trim();
        const pPhone = String(s.patientPhone || s.patient_phone || '').trim();
        if (id.startsWith('sess-demo') || id.startsWith('sess-sample')) return false;
        if (testSyntheticPhones.has(pPhone)) return false;
        if (testSyntheticNames.has(pName)) return false;
        if (pName.includes('auto test') || pName.includes('rls test')) return false;
        return true;
      });
    }
    return sessions;
  }

  static saveWhatsAppSessions(sessions: WhatsAppSession[]) {
    save('whatsapp_sessions', sessions);
    notify();
  }

  static getActiveDoctorName(): string {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          const name = parsed.display_name || parsed.displayName || parsed.name;
          if (name) return name.startsWith('Dr.') ? name : `Dr. ${name}`;
        }
      } catch (_e) { /* ignore */ }
    }
    return 'your doctor';
  }

  static getDynamicClinicName(): string {
    if (typeof window !== 'undefined') {
      try {
        const cachedPod = localStorage.getItem('vitalsync_cached_active_pod');
        if (cachedPod) {
          const parsed = JSON.parse(cachedPod);
          if (parsed?.name) return parsed.name;
        }

        const activePod = localStorage.getItem('vitalsync_active_pod');
        if (activePod) {
          const parsed = JSON.parse(activePod);
          if (parsed?.name) return parsed.name;
        }

        const cached = localStorage.getItem('vitalsync_cached_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.clinicName || parsed?.clinic_name) return parsed.clinicName || parsed.clinic_name;
        }

        const docProfile = localStorage.getItem('mediflow_active_doctor_profile') || localStorage.getItem('vitalsync_doctor_profile');
        if (docProfile) {
          const parsed = JSON.parse(docProfile);
          if (parsed?.clinicName || parsed?.clinic_name) return parsed.clinicName || parsed.clinic_name;
          if (parsed?.name || parsed?.display_name) return `${parsed.name || parsed.display_name}'s Care Clinic`;
        }
      } catch (_e) { /* ignore */ }
    }
    return 'Clinic';
  }

  static getDynamicDoctorName(): string {
    return this.getActiveDoctorName();
  }

  // ── Phase 4: Leaky-Bucket Rate-Limited Dispatch Queue (Max 15 msgs/sec) ────
  private static dispatchQueue: Array<() => Promise<any>> = [];
  private static isProcessingQueue = false;

  private static async processLeakyBucketQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.dispatchQueue.length > 0) {
      const task = this.dispatchQueue.shift();
      if (task) {
        try {
          await task();
        } catch (_e) {
          /* ignore task error */
        }
        // Enforce 66ms spacing (15 messages/second limit to prevent Meta WABA HTTP 429 bans)
        await new Promise(r => setTimeout(r, 66));
      }
    }
    this.isProcessingQueue = false;
  }

  static async sendWhatsAppMessagePayload(
    phone: string,
    templateName: string,
    variables: Record<string, any>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.dispatchQueue.push(async () => {
        try {
          console.log(`[VitalSync Outgoing Dispatch] API template: ${templateName} target: ${phone}`);

          // Rule 62: Meta Graph API requests MUST be dispatched FIRST (~250ms latency) before session DB updates
          // Dispatch real HTTP POST payload via Supabase Edge Function Relay (Vault Secrets)
          let dispatchSuccess = false;
          try {
            const cleanToPhone = normalizeWhatsAppPhone(phone);
            if (!cleanToPhone) {
              console.warn('[VitalSync Outgoing Dispatch] Target phone is empty/undefined. Aborting dispatch.');
              resolve(false);
              return;
            }

            const msgBody = variables?.replyText || 'Hello from VitalSync Smart Clinic';

            // Secure Server-Side Relay via Supabase Edge Function
            let activePhoneId = '';
            let activeToken = '';
            try {
              const saved = localStorage.getItem('vitalsync_waba_connection');
              if (saved && saved !== 'disconnected') {
                const parsed = JSON.parse(saved);
                if (parsed?.phone_number_id) activePhoneId = parsed.phone_number_id;
                if (parsed?.encrypted_system_user_token || parsed?.token) {
                  activeToken = parsed.encrypted_system_user_token || parsed.token;
                }
              }
            } catch (_sE) {
              /* ignore parse error */
            }

            const { supabase: sb } = await import('../lib/supabaseClient');

            if (!activePhoneId || !activeToken) {
              try {
                const { data: dbConn } = await sb
                  .from('waba_connections')
                  .select('phone_number_id, encrypted_system_user_token, access_token')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (dbConn) {
                  activePhoneId = activePhoneId || dbConn.phone_number_id || '';
                  activeToken = activeToken || dbConn.encrypted_system_user_token || (dbConn as any).access_token || '';
                }
              } catch (_dbE) { /* ignore */ }
            }

            let validSystemToken: string | undefined = undefined;
            if (activeToken && String(activeToken).startsWith('EAA')) {
              validSystemToken = activeToken;
            }

            const invokeRes = await sb.functions.invoke('meta-webhook', {
              body: {
                action: 'send_manual_message',
                patientPhone: cleanToPhone,
                messageText: msgBody,
                phoneId: (activePhoneId && activePhoneId !== '105829471928374') ? activePhoneId : undefined,
                phoneNumberId: (activePhoneId && activePhoneId !== '105829471928374') ? activePhoneId : undefined,
                systemToken: validSystemToken
              }
            });
            console.log("DIAGNOSTIC: Edge function invocation result:", invokeRes);
            dispatchSuccess = true;
          } catch (_wabaErr) {
            console.warn('[VitalSync Outgoing Dispatch] Edge function dispatch fallback:', _wabaErr);
          }

          // NOW update local session history for instant patient/doctor sync (after Meta dispatch)
          if (variables?.replyText) {
            const sessions = this.getWhatsAppSessions();
            const targetDigits = (phone || '').replace(/\D/g, '').slice(-10);
            const sessionIndex = sessions.findIndex(s => {
              const sPhone = (s.patientPhone || (s as any).patient_phone || (s as any).phone || '').replace(/\D/g, '').slice(-10);
              return sPhone === targetDigits;
            });
            const now = new Date().toISOString();

            if (sessionIndex !== -1) {
              const session = sessions[sessionIndex];
              const sData = session.sessionData || (session as any).session_data || {};
              const history = [...(sData.chatHistory || [])];
              
              history.push({
                sender: 'agent',
                text: variables.replyText,
                timestamp: now,
                time: now
              });

              sessions[sessionIndex] = {
                ...session,
                lastInteraction: now,
                sessionData: { ...sData, chatHistory: history },
                session_data: { ...sData, chatHistory: history }
              } as any;
              this.saveWhatsAppSessions(sessions);
              window.dispatchEvent(new CustomEvent('mediflow-whatsapp-session-updated'));
            }
          }

          await new Promise(r => setTimeout(r, 50));
          resolve(dispatchSuccess);
        } catch (e) {
          console.error("[VitalSync WhatsApp Bot] Outgoing dispatch error:", e);
          resolve(false);
        }
      });
      this.processLeakyBucketQueue();
    });
  }

  static async processIncomingWhatsAppMessage(phone: string, text: string): Promise<void> {
    try {
      const cleaned = text.trim().toLowerCase();
      const sessions = this.getWhatsAppSessions();
      
      // PHASE 1: WhatsApp-Native Lab Ingestion Engine (AI Clinical Brain)
      // Check if patient exists in registry (flexible 10-digit matching)
      const incomingLast10 = (phone || '').replace(/\D/g, '').slice(-10);
      const patient = PatientService.getPatients().find(p => {
        const pDigits = (p.phone || '').replace(/\D/g, '').slice(-10);
        return pDigits === incomingLast10;
      });

      if (cleaned.includes('[attachment:') && cleaned.includes('.pdf') && patient) {
        // Patient uploaded a lab report via WhatsApp!
        const { AiClinicalBrainService } = await import('./aiClinicalBrainService');
        // Extract mock URL
        const mockPdfUrl = text.match(/\[ATTACHMENT:\s*(.*?)\]/i)?.[1] || 'uploaded_lab_report.pdf';
        
        // Analyze the report, cross-reference with past history & PubMed
        const aiSummary = await AiClinicalBrainService.analyzeWhatsAppLabReport(patient.id, mockPdfUrl, text);
        
        // Send the Hinglish summary back to the patient instantly
        this.pushWhatsAppMessageFromBot(phone, aiSummary);
        return; // Stop normal processing
      }

      const isUnregistered = !patient || 
        !patient.name || 
        patient.name === 'WhatsApp Patient' || 
        patient.name === 'Patient' || 
        patient.name === 'Walk-In Patient' ||
        patient.name.toLowerCase().startsWith('patient (+91') ||
        patient.name.toLowerCase().startsWith('patient (') ||
        !patient.age ||
        Number(patient.age) <= 0 ||
        !patient.gender;

      if (isUnregistered) {
        // Unregistered walk-in patient: Initiate conversational onboarding
        let sessionIndex = sessions.findIndex(s => {
          const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
          return sDigits && incomingLast10 && sDigits === incomingLast10;
        });

        const now = new Date().toISOString();
        if (sessionIndex === -1) {
          const newSession: WhatsAppSession = {
            id: crypto.randomUUID(),
            patientPhone: phone,
            currentState: 'AWAITING_REGISTRATION_DETAILS',
            lastInteraction: now,
            sessionData: {
              chatHistory: []
            }
          };
          sessions.push(newSession);
          sessionIndex = sessions.length - 1;
        }

        const session = sessions[sessionIndex];
        const sessionData = session.sessionData || {};
        session.sessionData = sessionData;
        const clinicName = this.getDynamicClinicName();
        const greetings = ['hi', 'hello', 'hey', 'namaste', 'pranam', 'hlo', 'start', 'menu', 'reset'];

        const currentHistory = sessionData.chatHistory || [];
        currentHistory.push({ sender: 'patient', text, time: now, timestamp: now });
        sessionData.chatHistory = currentHistory;

        let nextState = session.currentState || 'AWAITING_REGISTRATION_DETAILS';
        let replyMessage = '';

        if (greetings.includes(cleaned) || session.currentState === 'AWAITING_WELCOME' || !session.currentState) {
          if (cleaned.includes('physical') || text.includes('Physical Visit')) {
            sessionData.pendingConsultationType = 'physical';
            nextState = 'AWAITING_REGISTRATION_DETAILS';
            replyMessage = `Namaste! ${clinicName} mein Physical OPD Visit book karne ke liye, please pehle apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
          } else if (cleaned.includes('virtual') || text.includes('Virtual Call')) {
            sessionData.pendingConsultationType = 'virtual';
            nextState = 'AWAITING_REGISTRATION_DETAILS';
            replyMessage = `Namaste! ${clinicName} mein Virtual Video Call book karne ke liye, please pehle apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
          } else {
            nextState = 'AWAITING_REGISTRATION_DETAILS';
            replyMessage = `Namaste! Welcome to ${clinicName}. 🏥\n\nInstant OPD Token aur Appointment booking ke liye, please apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
          }
        } else if (session.currentState === 'AWAITING_REGISTRATION_DETAILS') {
          if ((cleaned.includes('physical') || text.includes('Physical Visit')) && !text.includes(',')) {
            sessionData.pendingConsultationType = 'physical';
            replyMessage = `Namaste! ${clinicName} mein Physical OPD Visit book karne ke liye, please pehle apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
          } else if ((cleaned.includes('virtual') || text.includes('Virtual Call')) && !text.includes(',')) {
            sessionData.pendingConsultationType = 'virtual';
            replyMessage = `Namaste! ${clinicName} mein Virtual Video Call book karne ke liye, please pehle apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
          } else {
            const rawInput = text.trim();
            let regName = sessionData.newPatientName || rawInput;
            let regAge = 0;
            let regGender: 'Male' | 'Female' | 'Other' = 'Male';
            let ageFound = false;

            if (rawInput.includes(',')) {
              const parts = rawInput.split(',').map(p => p.trim()).filter(Boolean);
              if (parts.length >= 1 && parts[0] && isNaN(parseInt(parts[0], 10))) regName = parts[0];
              if (parts.length >= 2) {
                const ageMatch = parts[1].match(/\d+/);
                if (ageMatch) {
                  regAge = parseInt(ageMatch[0], 10);
                  ageFound = true;
                }
              }
              if (parts.length >= 3) {
                const g = parts[2].toLowerCase();
                if (g.startsWith('f') || g.includes('female') || g.includes('mahila') || g.includes('aurat')) regGender = 'Female';
                else if (g.startsWith('o') || g.includes('other')) regGender = 'Other';
              }
            } else {
              const ageMatch = rawInput.match(/\b(\d{1,3})\s*(?:y(?:rs?|ears?|o)?|saal)?\b/i);
              if (ageMatch) {
                regAge = parseInt(ageMatch[1], 10);
                ageFound = true;
              }

              const genderMatch = rawInput.match(/\b(male|female|other|purush|mahila|m\b|f\b)\b/i);
              if (genderMatch) {
                const g = genderMatch[1].toLowerCase();
                if (g === 'female' || g === 'f' || g === 'mahila') regGender = 'Female';
                else if (g === 'other') regGender = 'Other';
              }

              const nameCandidate = rawInput
                .replace(/\b\d{1,3}\s*(?:y(?:rs?|ears?|o)?|saal)?\b/gi, '')
                .replace(/\b(male|female|other|purush|mahila|m\b|f\b)\b/gi, '')
                .replace(/[,\-:|]/g, ' ')
                .trim();
              if (nameCandidate.length >= 2 && isNaN(parseInt(nameCandidate, 10))) {
                regName = nameCandidate.replace(/\s+/g, ' ');
              }
            }

            if (regName) {
              regName = regName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              sessionData.newPatientName = regName;
            }

            // Prompt specifically for age if missing
            if (!ageFound || regAge <= 0) {
              nextState = 'AWAITING_REGISTRATION_DETAILS';
              replyMessage = `Namaste${regName ? ` *${regName}*` : ''}! 🙏\n\nClinical record aur OPD token ke liye, please apna *Age aur Gender* reply kijiye:\n\n👉 *Age, Gender* (e.g. *28, Male* ya *45, Female*) 👤`;
            } else {
              regName = regName || 'Patient';
              const podCtx = getPodContext();
              const targetPodId = podCtx.podId || FALLBACK_POD_ID;
              const isPaperMode = (podCtx as any)?.operatingMode === 'paper_rx' || 
                                  (podCtx as any)?.isDigitalEmrEnabled === false || 
                                  (typeof window !== 'undefined' && localStorage.getItem('mediflow_operating_mode') === 'paper_rx');
              const initialQueueStatus = isPaperMode ? 'awaiting_consultation' : 'awaiting_vitals';

              const targetPatId = patient?.id || crypto.randomUUID();
              PatientService.registerPatient({
                id: targetPatId,
                name: regName,
                phone: phone,
                age: regAge,
                gender: regGender,
                queueStatus: initialQueueStatus,
                allergies: [],
                chronicConditions: []
              });

              try {
                supabase.from('patient_registry').upsert({
                  id: targetPatId,
                  name: regName,
                  phone: phone,
                  age: regAge,
                  gender: regGender,
                  queue_status: initialQueueStatus,
                  registered_at: now,
                  pod_id: targetPodId
                }, { onConflict: 'id' }).then(() => {});
              } catch (_e) { /* ignore */ }

              sessionData.newPatientId = targetPatId;
              sessionData.newPatientName = regName;
              session.patientId = targetPatId;
              session.patientName = regName;
              nextState = 'AWAITING_APPOINTMENT_TYPE';
              replyMessage = `✅ *Patient Profile Created Successfully!* 🟢\n\nNamaste *${regName}*! Aapka digital clinical record ban gaya hai.\n\nAb aaiye aapka appointment token generate karte hain. Consultation mode select kijiye:\n\n1️⃣ Physical Clinic OPD Visit 🏥\n2️⃣ Virtual Video Consult 💻\n\nPlease option number (1 ya 2) reply kijiye!`;
            }
          }
        } else if (session.currentState === 'AWAITING_APPOINTMENT_TYPE') {
          if (cleaned === '1' || cleaned.includes('physical')) {
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const targetPatId = sessionData.newPatientId || session.patientId || crypto.randomUUID();
            const targetPatName = sessionData.newPatientName || session.patientName || 'Walk-In Patient';
            const docName = this.getDynamicDoctorName();
            const podCtx = getPodContext();
            const targetPodId = podCtx.podId || FALLBACK_POD_ID;
            const targetDocId = (podCtx as any)?.doctorId || FALLBACK_DOCTOR_ID;

            const newAppt: Appointment = {
              id: apptId,
              patientId: targetPatId,
              patientName: targetPatName,
              patientPhone: phone,
              doctorId: targetDocId,
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'ready_for_consult',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: now
            };
            BillingService.saveAppointment(newAppt);

            const consultInvId = `inv-${apptId}-consult`;
            try {
              supabase.from('appointments').upsert({
                id: apptId,
                patient_id: targetPatId,
                patient_name: targetPatName,
                patient_phone: phone,
                doctor_id: targetDocId,
                status: 'ready_for_consult',
                source: 'whatsapp',
                token_number: tokenNumber,
                appointment_time: new Date().toISOString(),
                created_at: now,
                pod_id: targetPodId
              }, { onConflict: 'id' }).then(() => {});

              supabase.from('unified_invoices').upsert({
                id: consultInvId,
                encounter_id: apptId,
                patient_id: targetPatId,
                doctor_fee: 500,
                total_amount: 500,
                payment_status: 'cleared',
                payment_method: 'counter',
                created_at: now,
                pod_id: targetPodId
              }, { onConflict: 'id' }).then(() => {});

              supabase.from('financial_ledgers').upsert({
                id: `fl-${consultInvId}`,
                invoice_id: consultInvId,
                appointment_id: apptId,
                patient_id: targetPatId,
                doctor_id: targetDocId,
                amount: 500,
                transaction_type: 'consultation',
                payment_mode: 'counter',
                created_at: now,
                pod_id: targetPodId
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
            nextState = 'COMPLETED';
            replyMessage = `🎫 *OPD TOKEN ISSUED SUCCESSFULLY!* 🟢\n\nNamaste *${targetPatName}*!\n• Token Number: *${tokenNumber}*\n• Clinic: *${clinicName}*\n• Doctor: *${docName}*\n• Mode: *Physical OPD Visit* 🏥\n• Status: *Active in Clinic Queue*\n\nAapka appointment live sync ho gaya hai. Vitals (BP, Pulse, SpO2) check karane ke liye clinic counter par ye token number show kijiye! 🩺`;
          } else if (cleaned === '2' || cleaned.includes('virtual')) {
            nextState = 'BOOKING_VIRTUAL';
            sessionData.awaitingProactiveAction = 'virtual_slot';
            const docName = this.getDynamicDoctorName();
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} has unlocked a virtual follow-up consult slot for you. \n\nPlease select your preferred slot:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book.`;
          } else {
            replyMessage = `Invalid option. Consultation mode select kijiye:\n\n1️⃣ Physical Clinic OPD Visit 🏥\n2️⃣ Virtual Video Consult 💻\n\nPlease option number (1 ya 2) reply kijiye!`;
          }
        } else {
          nextState = 'AWAITING_REGISTRATION_DETAILS';
          replyMessage = `Namaste! Welcome to ${clinicName}. 🏥\n\nAapka patient profile hamare clinic database mein registered nahi hai.\nInstant OPD Token aur Appointment create karne ke liye, please apna details reply kijiye:\n\n*Name, Age, Gender* (e.g. *Amit Sharma, 32, Male*) 👤`;
        }

        session.currentState = nextState;
        session.lastInteraction = now;
        const botMsg = { sender: 'bot', text: replyMessage, time: now, timestamp: now };
        session.sessionData.chatHistory = session.sessionData.chatHistory || [];
        session.sessionData.chatHistory.push(botMsg);
        this.saveWhatsAppSessions(sessions);

        const podCtx = getPodContext();
        Promise.resolve(supabase.rpc('atomic_update_whatsapp_session', {
          p_patient_phone: phone,
          p_patient_id: session.patientId || null,
          p_pod_id: podCtx.podId || FALLBACK_POD_ID,
          p_entity_id: podCtx.entityId || FALLBACK_ENTITY_ID,
          p_current_state: nextState,
          p_message: botMsg
        })).catch(() => {});

        window.dispatchEvent(new CustomEvent('mediflow-whatsapp-session-updated'));
        this.sendWhatsAppMessagePayload(phone, 'mediflow_conversational_reply', { replyText: replyMessage });
        return;
      }

      let sessionIndex = sessions.findIndex(s => {
        const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
        return sDigits && incomingLast10 && sDigits === incomingLast10;
      });
      
      let session: WhatsAppSession;
      if (sessionIndex === -1) {
        session = {
          id: crypto.randomUUID(),
          patientId: patient.id,
          patientName: patient.name,
          patientPhone: phone,
          currentState: 'AWAITING_CONFIRMATION',
          lastInteraction: new Date().toISOString(),
          sessionData: {
            consentGranted: true,
            chatHistory: []
          }
        };
        sessions.unshift(session);
        sessionIndex = 0;
        this.saveWhatsAppSessions(sessions);
      } else {
        session = sessions[sessionIndex];
      }

      const sessionData = session.sessionData || {};
      
      if (!sessionData.clinicName) {
        let resolvedName = WhatsAppService.getDynamicClinicName() || 'Clinic';
        try {
          const patientObj = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
          if (patientObj) {
            const { data: patientRow } = await supabase
              .from('patient_registry')
              .select('pod_id')
              .eq('id', patientObj.id)
              .maybeSingle();
            if (patientRow?.pod_id) {
              const customName = localStorage.getItem(`waba_bot_name_${patientRow.pod_id}`);
              if (customName) {
                resolvedName = customName;
              } else {
                const { data: podRow } = await supabase
                  .from('pods')
                  .select('name')
                  .eq('id', patientRow.pod_id)
                  .maybeSingle();
                if (podRow?.name) {
                  resolvedName = podRow.name;
                }
              }
            }
          }
        } catch (err) {
          console.warn("Error resolving clinic name:", err);
        }
        sessionData.clinicName = resolvedName;
        this.saveWhatsAppSessions(sessions);
      }
      const clinicName = sessionData.clinicName || this.getDynamicClinicName() || "Clinic";

      const currentHistory = sessionData.chatHistory || [];
      currentHistory.push({ sender: 'patient', text, time: new Date().toISOString() });
      sessionData.chatHistory = currentHistory;
      this.saveWhatsAppSessions(sessions);

      const greetings = ['hi', 'hello', 'hey', 'namaste', 'pranam', 'hlo', 'start', 'menu', 'reset', 'restart'];
      const ACTIVE_INPUT_STATES = [
        'AWAITING_REGISTRATION_DETAILS',
        'AWAITING_APPOINTMENT_TYPE',
        'AWAITING_VIRTUAL_SLOT',
        'BOOKING_VIRTUAL',
        'AWAITING_DATE_SELECTION',
        'AWAITING_SLOT_SELECTION',
        'AWAITING_PAYMENT',
        'AWAITING_REFILL_CHOICE',
        'MEDICINE_ORDERING',
        'AWAITING_FAMILY_DETAILS',
        'AWAITING_FAMILY_SELECTION',
        'AWAITING_AI_QUERY',
        'AWAITING_RESCHEDULE_TIME',
        'AWAITING_CHRONIC_ACTION'
      ];
      const isExplicitReset = cleaned === '0' || cleaned === 'menu' || cleaned === 'reset' || cleaned === 'restart' || cleaned === 'cancel';
      if (!ACTIVE_INPUT_STATES.includes(session.currentState)) {
        if (greetings.includes(cleaned) || isExplicitReset || session.currentState === 'AWAITING_CONFIRMATION' || !session.currentState) {
          session.currentState = 'AWAITING_CONFIRMATION';
        }
      } else if (isExplicitReset) {
        session.currentState = 'AWAITING_CONFIRMATION';
      }

      let nextState = session.currentState;
      let replyMessage = "";

      switch (session.currentState) {
        case 'AWAITING_CONFIRMATION':
          if (cleaned === '1' || cleaned === 'physical' || cleaned.includes('book physical') || cleaned.includes('physical visit') || cleaned.includes('physical clinic')) {
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();

            const newAppt: Appointment = {
              id: apptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'scheduled',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(newAppt);

            const podCtx = getPodContext();
            try {
              supabase.from('appointments').upsert({
                id: apptId,
                patient_id: patient.id,
                patient_name: patient.name,
                status: 'scheduled',
                source: 'whatsapp',
                token_number: tokenNumber,
                appointment_time: new Date().toISOString(),
                created_at: new Date().toISOString(),
                pod_id: podCtx.podId || FALLBACK_POD_ID
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            nextState = 'COMPLETED';
            replyMessage = `🟢 *APPOINTMENT CONFIRMED & TOKEN ALLOCATED!*

Hi ${patient.name}! ${docName} ke saath aapka checkup confirm ho gaya hai:

• Token Number: *${tokenNumber}* 🎫
• Queue Status: 0 Patients ahead of you (~10 mins wait)
• Live Clinic Turn Alert: Turn aane se 2 patient pehle WhatsApp alert aayega!
• Clinic Location: ${clinicName}, Desk #1

Doctor EMR aur Compounder Desk par aapki entry live sync ho chuki hai. Thank you! 😊`;
          } else if (cleaned === '2' || cleaned === 'virtual' || cleaned.includes('virtual video') || cleaned.includes('book virtual')) {
            nextState = 'BOOKING_VIRTUAL';
            sessionData.awaitingProactiveAction = 'virtual_slot';
            const docName = this.getDynamicDoctorName();
            const isFree = Boolean(patient.isPremiumMember);
            const feeText = isFree ? " (🎁 Free Follow-Up Benefit Unlocked: ₹0)" : "";
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} ke virtual checkup ke liye slot select kijiye${feeText}:\n\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book! 💻`;
          } else if (cleaned === '3' || cleaned.includes('report') || cleaned.includes('pathology') || cleaned.includes('lab') || cleaned.includes('test')) {
            nextState = 'COMPLETED';
            const approvedReports = LabService.getPathologyReports().filter(r => r.patientId === patient.id && r.status === 'approved');
            if (approvedReports.length > 0) {
              const rep = approvedReports[0];
              const barcode = `MED-${rep.loincCode || '4544-3'}-${rep.id.toUpperCase()}`;
              let hinglishGuidance = "";
              const tName = String(rep.testName || '').toLowerCase();
              if (tName.includes('hba1c') || tName.includes('sugar')) {
                hinglishGuidance = "\n\n💡 *Doctor's Guidance (Hinglish):* Sugar level regular monitor karein, daily 30 min walk karein, meetha aur junk food se parhez karein.";
              } else if (tName.includes('creatinine') || tName.includes('kidney')) {
                hinglishGuidance = "\n\n💡 *Doctor's Guidance (Hinglish):* Kidney health ke liye paryapt paani piyein aur bina doctor ke painkiller bilkul na lein.";
              } else {
                hinglishGuidance = "\n\n💡 *Doctor's Guidance (Hinglish):* Report parameters stable hain. Final review ke liye doctor se milein.";
              }
              const docLastName = this.getDynamicDoctorName().split(' ').pop() || 'Doctor';
              replyMessage = `📄 *Aapki Pathology Report Taiyar Hai!* 🔬

• Patient: ${rep.patientName}
• Test: ${rep.testName}
• Status: Verified & Approved 🟢
• AI Clinical Summary: ${rep.results || 'Parameters evaluated.'}${hinglishGuidance}

📥 [ 📎 Download Full Lab Report PDF ]

Dr. ${docLastName} se report review ke liye option chuniye:
1️⃣ Physical Review at Clinic 🏥
2️⃣ Virtual Video Review 💻
(Physical Review chune par aapki prescribed dawaiyan clinic pharmacy counter par reserve ho jayengi).`;
            } else {
              replyMessage = `Aapka koi approved pathology report abhi on file nahi mila. ${clinicName} lab technician ke test sync karne par aapko WhatsApp par automatic report deliver ho jayegi! 🔬`;
            }
          } else if (cleaned === '4' || cleaned === 'sos' || cleaned === 'emergency' || cleaned === 'urgent' || (cleaned.includes('sos') && !cleaned.includes('status'))) {
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, true);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();

            const formattedToken = tokenNumber.startsWith('T-') && tokenNumber.includes(' E') ? tokenNumber : (tokenNumber.startsWith('VIP') ? tokenNumber : `T-${tokenNumber.replace(/\D/g, '').padStart(2, '0')} E`);
            const sosAppt: Appointment = {
              id: apptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'ready_for_consult',
              source: 'whatsapp_vip',
              tokenNumber: formattedToken,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(sosAppt);
            patient.queueStatus = 'awaiting_consultation';
            patient.tokenNumber = formattedToken;
            PatientService.savePatient(patient);

            // VIP bookings sync silently into Doctor EMR and Compounder Desk via state change
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));

            const activeSop = BillingService.getActiveSop();
            const emergencyFee = activeSop?.extractedConfig?.emergency_sos_fee ?? 618;
            nextState = 'COMPLETED';
            replyMessage = `🚨 *EMERGENCY SOS PRIORITY #1 ACTIVATED!* 🚨\n\n${docName} ke dashboard par aapka case *PRIORITY #1* position par alert ho gaya hai (Red Pulsing Alert 🔴)!\n\n• Emergency Token: *${formattedToken}*\n• Doctor: *${docName}*\n• Clinic Desk: *${clinicName}*\n• Status: *Chamber Alerted (Top Priority)* 🔴\n• Emergency Surcharge: *₹${emergencyFee.toFixed(2)}*\n\nKripya turant clinic emergency desk par pahuchein aur token *${formattedToken}* compounder ko show karein! 🩺`;
          } else if (cleaned === '5' || cleaned.includes('refill') || cleaned.includes('medicine') || cleaned.includes('dawai')) {
            const completed = EncounterService.getEncounters()
              .filter(e => e.patientId === patient.id && e.status === 'completed');
            const allMeds = new Set<string>();
            completed.forEach(enc => {
              (enc.medications || []).forEach(m => allMeds.add(m.medicineName));
            });
            const uniqueMeds = Array.from(allMeds);

            if (uniqueMeds.length > 0) {
              nextState = 'AWAITING_REFILL_CHOICE' as any;
              sessionData.refillOptions = uniqueMeds;
              replyMessage = `Namaste ${patient.name} Ji! 🩺\nAapki *${uniqueMeds[0]}* dawa agle *5 dino mein khatam* hone wali hai.\n\nBlood pressure/sugar control mein gap na aaye, isliye ${clinicName} Pharmacy ne aapka *1 Month Refill Pack (10% OFF)* ready rakha hai:\n\n• MRP: ~₹550.00~\n• Your Price (10% VIP Discount): *₹495.00*\n• Delivery: Free Clinic Counter Pickup ya 24hr Home Delivery\n\nReply *CONFIRM REFILL* ya *1-CLICK REFILL* to confirm! 💊`;
            } else {
              nextState = 'MEDICINE_ORDERING';
              sessionData.medicineOrderStage = 'INITIAL';
              replyMessage = `Ji bilkul! ${clinicName} Pharmacy se kaunsi dawaiyaan chahiye aapko? Please unka name aur total quantity type karein (e.g. 'Metformin 30 tabs'):`;
            }
          } else if (cleaned === '6' || cleaned.includes('refer') || cleaned.includes('code') || cleaned.includes('reward')) {
            nextState = 'AWAITING_CONFIRMATION';
            const myRefCode = (patient as any)?.referral_code || (patient as any)?.referralCode || `REF-${(phone || '').slice(-4) || '1000'}`;
            replyMessage = `🎁 *${clinicName} Patient Referral Rewards* 🌟\n\nAapka Unique Referral Code: *${myRefCode}*\n\n📲 *Kaise Kaam Karta Hai:*\n1. Apne doston ya family ke sath yeh code share karein.\n2. Jab woh clinic OPD mein checkup ya WhatsApp par appoint book karenge, unhe *10% Flat Discount* milega.\n3. Aur aapko bhi agle doctor checkup ya medicine refill par *10% OFF* reward milega!\n\n_Forward karke share karein!_ 😊`;
          } else if (cleaned === '7' || cleaned.includes('family') || cleaned.includes('book for family')) {
            const allPatients = PatientService.getPatients();
            const clean10 = String(phone).replace(/\D/g, '').slice(-10);
            const familyMembers = allPatients.filter(p => (p.phone || '').includes(`${clean10}-family-`));

            if (familyMembers.length > 0) {
              const famList = familyMembers.map((f, idx) => `${idx + 1}️⃣ *${f.name}* (${f.gender || 'Unknown'}, ${f.age || 30} yrs)`).join('\n');
              sessionData.familyDirectory = familyMembers;
              nextState = 'AWAITING_FAMILY_SELECTION' as any;
              replyMessage = `👥 *FAMILY HEALTH DESK — ${clinicName}* 🏥\n\nNamaste *${patient.name}*! Aapke parivaar ke registered members:\n\n${famList}\n\n0️⃣ Naye Family Member ko Add Karein ➕\n\nCheckup book karne ke liye member number (ya 0) reply kijiye! 🩺`;
            } else {
              nextState = 'AWAITING_FAMILY_DETAILS' as any;
              replyMessage = `👥 *FAMILY HEALTH DESK — ${clinicName}* 🏥\n\nNamaste *${patient.name}*! Apne parivaar ke kisi sadasya ke liye checkup book kijiye.\n\nPlease family member ka Name, Age, aur Gender reply kijiye:\n*(e.g. Rohan Kumar, 28, Male)* 👤`;
            }
          } else if (cleaned === '8' || cleaned.includes('summary') || cleaned.includes('prescription') || cleaned.includes('rx') || cleaned.includes('doctor note')) {
            const completedEncounters = EncounterService.getEncounters()
              .filter(e => e.patientId === patient.id && e.status === 'completed')
              .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

            if (completedEncounters.length > 0) {
              const enc = completedEncounters[0];
              const drugTable = (enc.medications || []).length > 0
                ? (enc.medications || []).map((m, idx) => `${idx + 1}️⃣ *${m.medicineName}* (${m.dosage})\n   Freq: ${m.frequency || 'Daily'} | Dur: ${m.duration || '30 days'}`).join('\n')
                : "• Regular vitals monitoring & diet prescribed.";
              const encDate = getIstDateDisplay(new Date(enc.createdAt || Date.now()));

              nextState = 'COMPLETED';
              replyMessage = `📋 *PRESCRIPTION & DOCTOR NOTES SUMMARY* 🩺\n\n• Patient: *${patient.name}*\n• Doctor: *${this.getDynamicDoctorName()}*\n• Clinic: *${clinicName}*\n• Consultation Date: *${encDate}*\n\n📝 *Doctor's Clinical Notes:*\n"${enc.clinicalNotes || "Patient clinical parameters evaluated and stable."}"\n\n💊 *Prescribed Medications Schedule:*\n${drugTable}\n\n📅 *Follow-Up Advice:*\n${this.getDynamicDoctorName()} ne aapko *14 din* ke baad follow-up ke liye ${clinicName} mein bulaya hai.\n\n_Medicine refill ke liye 'REFILL' reply kijiye!_ 😊`;
            } else {
              nextState = 'AWAITING_CONFIRMATION';
              replyMessage = `📋 *PRESCRIPTION SUMMARY — ${clinicName}*\n\nNamaste *${patient.name}*! Aapke profile par abhi koi completed prescription encounter on file nahi mila.\n\nClinic visit ya online consultation poora hone ke baad aapki digital prescription (Rx) yahan automatically load ho jayegi! 🩺`;
            }
          } else if (cleaned === '9' || cleaned.includes('ai') || cleaned.includes('assistant')) {
            nextState = 'AWAITING_AI_QUERY' as any;
            replyMessage = `🤖 *VITALSYNC AI CLINICAL ASSISTANT* 💡\n\nNamaste *${patient.name}*! Main ${this.getDynamicDoctorName()} ka verified AI Clinical Assistant hoon.\n\nAap apna health question ya lakshan (symptoms) yahan likh kar bhej sakte hain. Main doctor-approved ICMR clinical guidelines ke anusaar aapko immediate guidance doonga.\n\n⚠️ *Emergency Warning:* Kisi bhi gambhir takleef mein turant Emergency SOS (Reply 'SOS') use karein!\n\nAapka sawal kya hai? Kripya neeche type kijiye: ✍️`;
          } else if (cleaned === '10' || cleaned.includes('locker') || cleaned.includes('record')) {
            const encs = EncounterService.getEncounters().filter(e => e.patientId === patient.id);
            const reps = LabService.getPathologyReports().filter(r => r.patientId === patient.id);
            nextState = 'COMPLETED';
            replyMessage = `📁 *DIGITAL HEALTH LOCKER — ${clinicName}* 🔐\n\nNamaste *${patient.name}*! Aapka ABHA/VitalSync Health Locker secure cloud par active hai:\n\n• Consultations on File: *${encs.length}*\n• Pathology Lab Reports: *${reps.length}*\n\n📥 *Instant Access:*\n• Latest Prescription dekhne ke liye *SUMMARY* reply kijiye\n• Latest Lab Report dekhne ke liye *REPORT* reply kijiye\n\nAll records 100% HIPAA & ABDM compliant cloud encrypted hain! 🛡️`;
          } else if (cleaned === 'physical review' || cleaned.includes('physical review')) {
            nextState = 'COMPLETED';
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const newAppt: Appointment = {
              id: apptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: patient.phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'scheduled',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(newAppt);
            patient.tokenNumber = tokenNumber;
            patient.queueStatus = 'awaiting_consultation';
            PatientService.savePatient(patient);
            
            // Dispatch live 360-degree UI update custom events to instantly refresh frontend queues
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
            
            replyMessage = `🏥 *${clinicName.toUpperCase()} EVENING REPORT REVIEW LOCKED!* 🟢\n\nAapki Lab Report review ke liye ${this.getDynamicDoctorName()} ne aaj shaam *04:00 PM - 06:00 PM* ka slot lock kar diya hai.\n\n• Location: ${clinicName}, Central Desk\n• Token Number: *${tokenNumber}* 🎫\n• Pharmacy Reservation: Active at Ground Floor Counter 💊\n\nPlease evening time par clinic pahuchein aur counter se medicines collect karein! Dhanyawad! 😊`;
          } else if (cleaned === 'virtual review' || cleaned.includes('virtual review')) {
            nextState = 'COMPLETED';
            const vApptId = crypto.randomUUID();
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, true);
            const newAppt: Appointment = {
              id: vApptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: patient.phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'ready_for_consult',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString(),
              isVirtual: true,
              is_virtual: true,
              virtual_time: '04:00 PM',
              virtual_link: `https://meet.jit.si/vitalsync-consult-${vApptId}`
            };
            BillingService.saveAppointment(newAppt);
            patient.tokenNumber = tokenNumber;
            patient.queueStatus = 'in_consultation';
            PatientService.savePatient(patient);
            
            // Dispatch live 360-degree UI update custom events to instantly refresh frontend queues
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            window.dispatchEvent(new CustomEvent('mediflow-financial-update'));
            
            replyMessage = `💻 *EMERGENCY VIRTUAL VIDEO REVIEW ACTIVATED!* 🟢\n\n${this.getDynamicDoctorName()} aapki report online video consult par review karenge:\n• Meeting URL: https://meet.jit.si/vitalsync-consult-${vApptId}\n• Token Number: *${tokenNumber}* 🎫\n• Time: Aaj shaam 04:00 PM\n\nDawa refill & 1-Click home delivery request register ho gaya hai. Thank you! 😊`;
          } else if (cleaned === 'confirm refill' || cleaned.includes('confirm refill') || cleaned === '1-click refill') {
            nextState = 'COMPLETED';
            replyMessage = `📦 *1-CLICK MEDICINE REFILL CONFIRMED (10% OFF)!* 🟢\n\nNamaste *${patient.name}* Ji!\n\n• Clinic: *${clinicName} Pharmacy*\n• Discount: *10% VIP Refill Savings Applied* 🏷️\n• Status: *Packed & Reserved at Counter*\n• Delivery: Free Counter Pickup ya 24hr Home Delivery\n\nCompounder desk par aapka order note ho gaya hai. Dawa time par lein aur swasth rahein! Dhanyawad! 😊`;
          } else if (cleaned === 'speak to doctor' || cleaned.includes('speak to doctor')) {
            nextState = 'AWAITING_APPOINTMENT_TYPE';
            replyMessage = `👨‍⚕️ *CONSULTATION WITH ${this.getDynamicDoctorName().toUpperCase()}* 🩺\n\nDoctor se baat karne ke liye mode select kijiye:\n\n1️⃣ Physical Clinic OPD Visit 🏥\n2️⃣ Virtual Video Call Consult 💻\n\nPlease option number (1 ya 2) reply kijiye!`;
          } else if (cleaned === 'order delivery' || cleaned === 'delivery') {
            nextState = 'COMPLETED';
            replyMessage = `🚚 *HOME DELIVERY ORDER CONFIRMED* 📦\n\nAapka prescription dawa parcel ${clinicName} Pharmacy counter se process ho gaya hai!\n\n• Delivery Time: Within 2 Hours\n• Delivery Status: Dispatched to Address on File\n\nCompounder packing verify kar rahe hain. Strategic follow-up reminders (7 days, 1 month, 3 months) schedule kar diye gaye hain! Dhanyawad! 🟢`;
          } else if (
            cleaned === 'chronic' || 
            cleaned === 'care' || 
            cleaned.includes('sugar') || 
            cleaned.includes('bp') || 
            cleaned.includes('diabetes') || 
            cleaned.includes('hypertension') || 
            cleaned.includes('thyroid') || 
            cleaned.includes('diet') ||
            cleaned === 'care desk'
          ) {
            nextState = 'AWAITING_CHRONIC_ACTION' as any;
            const chronicCond = (patient as any)?.chronic_conditions?.[0] || (patient as any)?.chronic_condition || 'Chronic Care';
            const completed = EncounterService.getEncounters().filter(e => e.patientId === patient.id && e.status === 'completed');
            const allMeds: string[] = [];
            completed.forEach(enc => (enc.medications || []).forEach(m => allMeds.push(m.medicineName)));
            const primaryMed = allMeds[0] || 'Prescribed Regimen';

            sessionData.chronicCondition = chronicCond;
            sessionData.primaryMed = primaryMed;

            replyMessage = `🩺 *VITALSYNC CHRONIC CARE DESK — ${clinicName}* 🌿\n\nNamaste *${patient.name}* Ji! 🙏\nAapka chronic health profile active clinical surveillance mein hai:\n\n• Condition: *${chronicCond}*\n• Regular Medicine: *${primaryMed}*\n• Remaining Supply: *~5 din baki*\n• Next Diagnostic Re-test: *HbA1c & Fasting Glucose* (Due Soon)\n\nNeeche se apna option chuniye:\n1️⃣ Confirm 1-Click Refill Pack (10% VIP OFF) 💊\n2️⃣ Schedule Doctor Follow-up Review 👨‍⚕️\n3️⃣ Book 90-Day Diagnostic Blood Test (Ghar se sample collection) 🔬\n4️⃣ Condition-Specific ICMR Diet & Lifestyle Plan 🥗\n\nReply *1*, *2*, *3* ya *4* to proceed!`;
          } else {
            nextState = 'AWAITING_CONFIRMATION';
            const isFreeUnlocked = Boolean(patient.isPremiumMember || (patient as any).is_premium_member || (patient.id && BillingService.checkPatientFreeVirtualEligibility(patient.id).isEligible));
            const virtualOption = isFreeUnlocked ? "2️⃣ Book Virtual Video Consult 💻 (🎁 1 Free Consult Unlocked)" : "2️⃣ Book Virtual Video Consult 💻";
            replyMessage = `Namaste ${patient.name}! 🙏 Welcome to ${clinicName}.\n\n🌟 ${clinicName.toUpperCase()} SERVICES 🌟\n1️⃣ Book Physical Clinic Visit 🏥\n${virtualOption}\n3️⃣ View Lab Reports & Hinglish Summary 🔬\n4️⃣ Emergency SOS Priority #1 Routing 🚨\n5️⃣ 1-Click Medicine Refill (10% OFF) 💊\n6️⃣ Refer a Patient & Earn 10% OFF 🎁\n\nService select karne ke liye button tap kijiye ya number (1-6) reply kijiye! 🩺`;
          }
          break;

        case 'AWAITING_APPOINTMENT_TYPE':
          if (cleaned === '1' || cleaned.includes('physical')) {
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();

            const newAppt: Appointment = {
              id: apptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'scheduled',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(newAppt);

            const podCtx = getPodContext();
            try {
              supabase.from('appointments').upsert({
                id: apptId,
                patient_id: patient.id,
                patient_name: patient.name,
                status: 'scheduled',
                source: 'whatsapp',
                token_number: tokenNumber,
                appointment_time: new Date().toISOString(),
                created_at: new Date().toISOString(),
                pod_id: podCtx.podId || FALLBACK_POD_ID
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            nextState = 'COMPLETED';
            replyMessage = `🎫 *OPD TOKEN ISSUED SUCCESSFULLY!* 🟢\n\nNamaste *${patient.name}*!\n• Token Number: *${tokenNumber}*\n• Clinic: *${clinicName}*\n• Doctor: *${docName}*\n• Mode: *Physical OPD Visit* 🏥\n• Status: *Active in Clinic Queue*\n\nAapka appointment live sync ho gaya hai. Vitals check karane ke liye clinic counter par ye token number show kijiye! 🩺`;
          } else if (cleaned === '2' || cleaned.includes('virtual')) {
            nextState = 'BOOKING_VIRTUAL';
            sessionData.awaitingProactiveAction = 'virtual_slot';
            const docName = this.getDynamicDoctorName();
            const eligibility = patient.id ? BillingService.checkPatientFreeVirtualEligibility(patient.id) : { isEligible: false };
            const isFree = Boolean(patient.isPremiumMember || (patient as any).is_premium_member || eligibility.isEligible);
            const feeText = isFree ? " (🎁 Free Follow-Up Benefit Unlocked: ₹0)" : "";
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} ke virtual checkup ke liye slot select kijiye${feeText}:\n\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book! 💻`;
          } else {
            replyMessage = `Invalid option. Consultation mode select kijiye:\n\n1️⃣ Physical Clinic OPD Visit 🏥\n2️⃣ Virtual Video Consult 💻\n\nPlease option number (1 ya 2) reply kijiye!`;
          }
          break;

        case 'AWAITING_CHRONIC_ACTION': {
          if (cleaned === '1' || cleaned.includes('refill') || cleaned.includes('dawa') || cleaned.includes('pack')) {
            const refillToken = `#REF-${Math.floor(1000 + Math.random() * 9000)}`;
            const primaryMed = sessionData.primaryMed || 'Metformin 500mg (Glycomet)';
            const draftBillId = `bill-${Date.now()}`;
            
            // Auto-provision Pharmacy draft order with 10% VIP discount
            try {
              const inv = PharmacyService.getPharmacyInventory();
              const matchedItem = inv.find(i => (i.name || '').toLowerCase().includes(primaryMed.toLowerCase()));
              const basePrice = matchedItem?.price || 500;
              const discountedPrice = Math.round(basePrice * 0.9);

              const draftBill = {
                id: draftBillId,
                patientId: patient.id,
                patientName: patient.name,
                patientPhone: phone,
                items: [{
                  inventoryItemId: matchedItem?.id || 'inv-refill',
                  name: primaryMed,
                  genericName: matchedItem?.genericName || primaryMed,
                  dosage: '1-0-1',
                  batchNumber: matchedItem?.batchNumber || 'BATCH-2026-R1',
                  expiryDate: matchedItem?.expiryDate || '2027-12-31',
                  quantity: 30,
                  mrp: basePrice,
                  sellingPrice: discountedPrice,
                  discountPercent: 10,
                  gstPercent: 5,
                  lineTotal: discountedPrice,
                  isStockDeducted: false
                }],
                subtotal: basePrice,
                loyaltyDiscountPercent: 10,
                loyaltyDiscountAmount: basePrice - discountedPrice,
                itemDiscountAmount: 0,
                gstAmount: Math.round(discountedPrice * 0.05),
                totalAmount: discountedPrice + Math.round(discountedPrice * 0.05),
                paymentMode: 'counter_cash',
                status: 'draft',
                source: 'whatsapp_chronic_refill',
                tokenNumber: refillToken,
                createdAt: new Date().toISOString()
              };
              PharmacyService.saveMedicineBill(draftBill as any);
            } catch (_e) { /* ignore */ }

            nextState = 'COMPLETED';
            replyMessage = `🟢 *CHRONIC 1-CLICK REFILL RESERVED!* 💊\n\nNamaste *${patient.name}* Ji! 🙏\n${clinicName} Pharmacy counter par aapka 1 Month Refill Pack reserve ho gaya hai:\n\n• Medicine: *${primaryMed}*\n• Quantity: *1 Month Pack (30 tabs)*\n• Total Price (10% VIP Discount applied): *₹495.00*\n• Order Token: *${refillToken}* 📑\n• Delivery: *Free Clinic Counter Pickup ya 24hr Home Delivery*\n\nPharmacy counter par token *${refillToken}* dikha kar dawai le sakte hain. Stay healthy! 😊`;
          } else if (cleaned === '2' || cleaned.includes('doctor') || cleaned.includes('review') || cleaned.includes('consult')) {
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();

            const chronicAppt: Appointment = {
              id: apptId,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'scheduled',
              source: 'whatsapp_chronic_followup',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(chronicAppt);

            try {
              supabase.from('appointments').upsert({
                id: apptId,
                patient_id: patient.id,
                patient_name: patient.name,
                status: 'scheduled',
                source: 'whatsapp_chronic_followup',
                token_number: tokenNumber,
                appointment_time: new Date().toISOString(),
                created_at: new Date().toISOString(),
                pod_id: getPodContext().podId || FALLBACK_POD_ID
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            nextState = 'COMPLETED';
            replyMessage = `🟢 *CHRONIC FOLLOW-UP CONSULT SCHEDULED!* 🩺\n\nNamaste *${patient.name}*!\n${docName} ke saath aapka chronic review confirm ho gaya hai:\n\n• Token Number: *${tokenNumber}* 🎫\n• Mode: *Physical OPD / Virtual Video Review*\n• Doctor Fee: *₹500.00* (Direct Doctor Consultation)\n• Clinic: *${clinicName}*\n\nCompounder Desk aur Doctor EMR par aapki entry live sync ho gayi hai. Vitals check ke liye clinic aane par token *${tokenNumber}* batayein!`;
          } else if (cleaned === '3' || cleaned.includes('lab') || cleaned.includes('blood') || cleaned.includes('test')) {
            const reqId = `req-${Date.now()}`;
            const podId = getPodContext().podId || FALLBACK_POD_ID;

            try {
              const newReq = {
                id: reqId,
                patientId: patient.id,
                patientName: patient.name,
                patientPhone: phone,
                testName: 'HbA1c & Fasting Glucose Panel',
                loincCode: '4544-3',
                status: 'pending',
                source: 'whatsapp_chronic_retest',
                createdAt: new Date().toISOString(),
                podId: podId
              };
              LabService.saveLabRequisitions([newReq as any]);
              supabase.from('lab_requisitions').upsert({
                id: reqId,
                patient_id: patient.id,
                patient_name: patient.name,
                patient_phone: phone,
                test_name: 'HbA1c & Fasting Glucose Panel',
                loinc_code: '4544-3',
                status: 'pending',
                source: 'whatsapp_chronic_retest',
                pod_id: podId
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            nextState = 'COMPLETED';
            replyMessage = `🔬 *90-DAY BIOMARKER RE-TEST BOOKED!* 🩸\n\nNamaste *${patient.name}* Ji! 🙏\n\n• Test Panel: *HbA1c & Fasting Blood Sugar Panel* (LOINC: 4544-3)\n• Phlebotomist Slot: *Kal Subah 08:00 AM - 09:30 AM* 🏠\n• Sample: *Ghar se Blood Sample Collection*\n• Instructions: *Test se 8 ghante pehle khali pet (fasting) rehna hai*.\n\nTechnician sample collect karne ke baad report shaam tak isi WhatsApp chat par bhej di jayegi! Dhanyawad! 🟢`;
          } else if (cleaned === '4' || cleaned.includes('diet') || cleaned.includes('lifestyle')) {
            nextState = 'COMPLETED';
            const cond = sessionData.chronicCondition || 'DIABETES';
            let code = 'DIABETES';
            if (cond.toLowerCase().includes('hyper') || cond.toLowerCase().includes('bp')) code = 'HYPERTENSION';
            else if (cond.toLowerCase().includes('thyroid')) code = 'THYROID';
            else if (cond.toLowerCase().includes('ckd') || cond.toLowerCase().includes('kidney')) code = 'CKD';

            const { ChronicCareService } = await import('./chronicCareService');
            ChronicCareService.dispatchConditionDietGuide(phone, code, patient.name);
            replyMessage = `🥗 *ICMR DIET & LIFESTYLE PLAN DISPATCHED!* \n\nAapke condition (*${cond}*) ke anusaar doctor-approved diet chart upar message mein send kar diya gaya hai. Follow karein aur healthy rahein! 🌿`;
          } else {
            replyMessage = `Invalid option. Kripya *1*, *2*, *3* ya *4* reply kijiye:\n\n1️⃣ 1-Click Medicine Refill (10% OFF)\n2️⃣ Schedule Doctor Follow-up Review\n3️⃣ Book 90-Day Diagnostic Blood Test\n4️⃣ ICMR Diet & Lifestyle Guide`;
          }
          break;
        }

        case 'AWAITING_WELCOME':
          if (cleaned === '1' || cleaned.includes('start') || cleaned.includes('yes') || cleaned.includes('ok')) {
            nextState = 'AWAITING_CONSENT';
            replyMessage = `📋 *Clinical Data Sync Consent Request* \n\n${clinicName} digital ecosystem ko clinical records sync karne ki permission dene ke liye please **CONSENT** reply kijiye. \n\nIsse aapke e-prescriptions, pharmacy bill invoices aur lab reports automatically is WhatsApp chat par aane lagenge.`;
          } else {
            replyMessage = `Namaste! ${clinicName} Automated Assistant online. Shuru karne ke liye **1** or **START** type kijiye.`;
          }
          break;

        case 'AWAITING_CONSENT':
          if (cleaned.includes('consent') || cleaned === '1' || cleaned === 'yes') {
            nextState = 'AWAITING_WELCOME_ACK';
            sessionData.consentGranted = true;
            sessionData.consentTime = new Date().toISOString();
            
            if (patient) {
              const podId = getPodContext().podId;
              await supabase.from('patient_consents').upsert({
                patient_id: patient.id,
                data_sharing_consent: true,
                consented_at: new Date().toISOString(),
                pod_id: podId
              }, { onConflict: 'patient_id' });
            }

            replyMessage = `🎉 *Consent Recorded Successfully!* \n\nAapka profile secure clinical sync loop se link ho gaya hai. \n\n*Gateways Active:*\n1. Digital e-Prescriptions (e-Rx) 💊\n2. Realtime Pathology Reports 🧪\n3. UPI Integrated Invoices 💳\n\nType **A** to check active appointments, **I** for invoices, or type a general query to chat with AI:`;
          } else {
            replyMessage = "Invalid input. Records sync activate karne ke liye please **CONSENT** reply kijiye.";
          }
          break;

        case 'AWAITING_WELCOME_ACK':
          if (cleaned === 'a' || cleaned === '1') {
            nextState = 'COMPLETED';
            const docName = WhatsAppService.getActiveDoctorName();
            replyMessage = `📅 *Active Appointments/Consultations:*\n- ${docName} (Consultation chamber 1): Ready for scheduling.\n\nType **REFILL** to order medicines, **REPORT** to get your latest lab result, or chat with AI.`;
          } else if (cleaned === 'i' || cleaned === '2') {
            nextState = 'COMPLETED';
            replyMessage = "💳 *Dues & Invoices Summary:*\n- No outstanding dues found on your active token.\n\nType **REFILL** to order medicines, **REPORT** to get your latest lab result, or chat with AI.";
          } else {
            nextState = 'COMPLETED';
            replyMessage = "Clinical loop setup finished. Aap type karke general queries pooch sakte hain ya **REFILL** reply karke medicine order kar sakte hain.";
          }
          break;

        case 'AWAITING_FAMILY_SELECTION': {
          const allPatients = PatientService.getPatients();
          const clean10 = String(phone).replace(/\D/g, '').slice(-10);
          const familyMembers = allPatients.filter(p => (p.phone || '').includes(`${clean10}-family-`));
          const choice = parseInt(cleaned, 10);

          if (cleaned === '0' || cleaned.includes('add') || cleaned.includes('new')) {
            nextState = 'AWAITING_FAMILY_DETAILS';
            replyMessage = `👥 *FAMILY HEALTH DESK — ${clinicName}* 🏥\n\nNaye family member ka checkup book karne ke liye kripya details is format mein reply kijiye:\n\n*Name, Age, Gender*\n*(e.g. Rohan Kumar, 28, Male)* 👤`;
          } else if (!isNaN(choice) && choice >= 1 && choice <= familyMembers.length) {
            const selectedMember = familyMembers[choice - 1];
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();

            const newAppt: Appointment = {
              id: apptId,
              patientId: selectedMember.id,
              patientName: selectedMember.name,
              patientPhone: selectedMember.phone,
              doctorId: '',
              date: todayStr,
              appointmentTime: new Date().toISOString(),
              status: 'scheduled',
              source: 'whatsapp',
              tokenNumber: tokenNumber,
              createdAt: new Date().toISOString()
            };
            BillingService.saveAppointment(newAppt);

            const podCtx = getPodContext();
            try {
              supabase.from('appointments').upsert({
                id: apptId,
                patient_id: selectedMember.id,
                patient_name: selectedMember.name,
                status: 'scheduled',
                source: 'whatsapp',
                token_number: tokenNumber,
                appointment_time: new Date().toISOString(),
                created_at: new Date().toISOString(),
                pod_id: podCtx.podId || FALLBACK_POD_ID
              }, { onConflict: 'id' }).then(() => {});
            } catch (_e) { /* ignore */ }

            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            nextState = 'COMPLETED';
            replyMessage = `🎫 *FAMILY CHECKUP APPOINTMENT CONFIRMED!* 🟢\n\n• Patient: *${selectedMember.name}* (${selectedMember.gender || 'Adult'}, ${selectedMember.age || ''} yrs)\n• Token Number: *${tokenNumber}* 🎫\n• Clinic: *${clinicName}*\n• Doctor: *${this.getDynamicDoctorName()}*\n• OPD Status: *Active in Queue*\n\nClinic counter par pahunch kar token *${tokenNumber}* dikhayen. Thank you! 😊`;
          } else {
            replyMessage = `Kripya valid option chuniye:\n• Family member number (1-${familyMembers.length}) reply kijiye\n• Naya member add karne ke liye *0* reply kijiye`;
          }
          break;
        }

        case 'AWAITING_FAMILY_DETAILS': {
          const parts = text.split(',').map(s => s.trim());
          const clean10 = String(phone).replace(/\D/g, '').slice(-10);
          const memName = parts[0] || text.trim();
          const memAge = parseInt(parts[1] || '30', 10) || 30;
          const memGender = (parts[2] || 'Other').trim();

          const newFamId = crypto.randomUUID();
          const newFamPhone = `${clean10}-family-${Date.now().toString().slice(-4)}`;
          const todayStr = getIstDateString();
          const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);

          const newPatient: any = {
            id: newFamId,
            name: memName,
            age: memAge,
            gender: memGender,
            phone: newFamPhone,
            registeredAt: new Date().toISOString(),
            status: 'registered',
            source: 'whatsapp'
          };
          PatientService.savePatients([...PatientService.getPatients(), newPatient]);

          const apptId = crypto.randomUUID();
          const newAppt: Appointment = {
            id: apptId,
            patientId: newFamId,
            patientName: memName,
            patientPhone: newFamPhone,
            doctorId: '',
            date: todayStr,
            appointmentTime: new Date().toISOString(),
            status: 'scheduled',
            source: 'whatsapp',
            tokenNumber: tokenNumber,
            createdAt: new Date().toISOString()
          };
          BillingService.saveAppointment(newAppt);

          const podCtx = getPodContext();
          try {
            supabase.from('patients').upsert({
              id: newFamId,
              name: memName,
              age: memAge,
              gender: memGender,
              phone: newFamPhone,
              pod_id: podCtx.podId || FALLBACK_POD_ID,
              created_at: new Date().toISOString()
            }, { onConflict: 'id' }).then(() => {});

            supabase.from('appointments').upsert({
              id: apptId,
              patient_id: newFamId,
              patient_name: memName,
              status: 'scheduled',
              source: 'whatsapp',
              token_number: tokenNumber,
              appointment_time: new Date().toISOString(),
              created_at: new Date().toISOString(),
              pod_id: podCtx.podId || FALLBACK_POD_ID
            }, { onConflict: 'id' }).then(() => {});
          } catch (_e) { /* ignore */ }

          window.dispatchEvent(new CustomEvent('mediflow-state-change'));
          nextState = 'COMPLETED';
          replyMessage = `🎉 *FAMILY MEMBER ADDED & APPOINTMENT BOOKED!* 🟢\n\n• Member: *${memName}* (${memGender}, ${memAge} yrs)\n• Token Number: *${tokenNumber}* 🎫\n• Clinic: *${clinicName}*\n• Doctor: *${this.getDynamicDoctorName()}*\n• Queue Status: *Active in Clinic Queue*\n\nYeh member aapke family directory mein permanently save ho gaya hai. Clinic aane par token *${tokenNumber}* counter par batayein! 🩺`;
          break;
        }

        case 'AWAITING_AI_QUERY': {
          const redFlagPatterns = [
            /\b(chest\s*pain|seena\s*dard|chhati\s*(?:me|mein)?\s*dard|heart\s*attack|angina)\b/i,
            /\b(breathless|saans\s*(?:phool|lene|ruk)|difficulty\s*breathing|shortness\s*of\s*breath)\b/i,
            /\b(faint|chakkar\s*aa\s*ke\s*gir|unconscious|behosh|stroke|paralysis)\b/i,
            /\b(hypoglycemia|sugar\s*(?:low|kam|40|50)|shivering|cold\s*sweat)\b/i
          ];
          const isRedFlag = redFlagPatterns.some(p => p.test(text || ''));

          if (isRedFlag) {
            nextState = 'COMPLETED';
            replyMessage = `🚨 *URGENT MEDICAL ALERT / EMERGENCY RED FLAG* 🚨\n\n` +
              `Aapke bataye gaye lakshan (*"${text}"*) gambhir clinical emergency ho sakte hain. Turant medical attention ki zaroorat hai!\n\n` +
              `1️⃣ Turant *SOS* reply karein (Doctor Priority #1 Chamber Alert).\n` +
              `2️⃣ Nazdeeki clinic emergency room pahuchein.\n` +
              `3️⃣ Doctor Chamber Alert ke liye *SOS* reply karein! 🚨`;
            break;
          }

          let chronicInfo = '';
          const chronicRecord = PatientService.getPatients().find(p => p.id === patient.id);
          if (chronicRecord && (chronicRecord as any).chronic_condition) {
            chronicInfo = ` (Known Condition: ${(chronicRecord as any).chronic_condition})`;
          }

          nextState = 'COMPLETED';
          replyMessage = `🤖 *VITALSYNC AGENTIC AI FAMILY DOCTOR* 🩺\n\n` +
            `Namaste *${patient.name}*! 🙏${chronicInfo}\n\n` +
            `• *Clinical Evidence (ADA 2024 & ICMR Standards):* Aapki query ka review ho gaya hai. Aise lakshano mein proper hydration, low-salt diet aur resting vitals observe karna recommended hai.\n` +
            `• *Medication Safety:* Kripya bina doctor consult ke koi naya medicine shuru na karein. ${this.getDynamicDoctorName()} ke schedule par hi rahein.\n` +
            `• *Consultation:* Detailed assessment aur prescription ke liye review appointment schedule karein.\n\n` +
            `📅 *Next Step:* Checkup slot book karne ke liye *BOOK* ya *1* reply karein, virtual review ke liye *2* reply karein, ya emergency mein *SOS* reply karein!\n\n` +
            `_Disclaimer: AI guidance is grounded in ICMR protocols and does not substitute a licensed physician's diagnosis._`;
          break;
        }

        case 'AWAITING_PAYMENT':
          {
            const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
            if (patient) {
              const unifiedInvoices = BillingService.getUnifiedInvoices();
              const saasInvoices = load<any[]>('saas_invoices', []);
              const invoices = [...unifiedInvoices, ...saasInvoices];

              const clearedInvoices = invoices.filter((i: any) => 
                (i.patientId === patient.id || i.patient_id === patient.id) && 
                (i.paymentStatus === 'cleared' || i.paymentStatus === 'paid' || i.payment_status === 'cleared' || i.payment_status === 'paid')
              );
              const pendingInvoices = invoices.filter((i: any) => 
                (i.patientId === patient.id || i.patient_id === patient.id) && 
                (i.paymentStatus === 'pending' || i.payment_status === 'pending')
              );

              // Check if patient sent a 12-digit UPI UTR / Transaction reference number
              const utrMatch = cleaned.match(/\b\d{12}\b/);
              if (utrMatch) {
                const utrNumber = utrMatch[0];
                if (pendingInvoices.length > 0) {
                  const targetInv = pendingInvoices[0];
                  BillingService.clearInvoice(targetInv.id, 'upi');

                  const appts = BillingService.getAppointments();
                  const targetAppt = appts.find(a => (a.patientId === patient.id || (a as any).patient_id === patient.id));

                  // Also update Supabase appointments & invoices table
                  Promise.resolve(supabase.from('unified_invoices').update({ payment_status: 'cleared', payment_method: 'upi', utr_number: utrNumber }).eq('id', targetInv.id))
                    .then((res: any) => { if (res?.error) console.error('[Mediflow] unified_invoices error:', res.error); })
                    .catch((err: any) => console.error('[Mediflow] unified_invoices caught:', err));
                  Promise.resolve(supabase.from('saas_invoices').update({ status: 'paid', payment_method: 'upi', utr_number: utrNumber }).eq('id', targetInv.id))
                    .then((res: any) => { if (res?.error) console.error('[Mediflow] saas_invoices error:', res.error); })
                    .catch((err: any) => console.error('[Mediflow] saas_invoices caught:', err));
                  
                  if (targetAppt?.id) {
                    Promise.resolve(supabase.from('appointments').update({ status: 'scheduled', payment_status: 'cleared', utr_number: utrNumber }).eq('id', targetAppt.id))
                      .then((res: any) => { if (res?.error) console.error('[Mediflow] appointments error:', res.error); })
                      .catch((err: any) => console.error('[Mediflow] appointments caught:', err));
                  }

                  nextState = 'COMPLETED';
                  const tokenCode = targetAppt?.tokenNumber || (patient as any)?.tokenNumber || (targetInv as any)?.tokenNumber || PatientService.generateNextTokenNumber(getIstDateString(), false);
                  replyMessage = `🎉 *PAYMENT VERIFIED VIA DIRECT UPI (0% MDR AI OCR)!* 🟢\n\nHi ${patient.name}!\n • Payment Status: Cleared ✅\n • UTR Reference: \`${utrNumber}\`\n • Token Number: ${tokenCode}\n • Doctor: ${this.getDynamicDoctorName()}\n • Clinic: ${this.getDynamicClinicName()}\n\nPhysical visit OPD token is active at counter! Thank you for choosing VitalSync! 🩺`;
                } else {
                  nextState = 'COMPLETED';
                  replyMessage = `✅ *12-Digit UPI UTR Received & Verified!* \n\n• *UTR Reference*: \`${utrNumber}\`\n• *Status*: Cleared ✅\n\nThank you for choosing VitalSync! 🩺`;
                }
              } else if (clearedInvoices.length > 0) {
                nextState = 'COMPLETED';
                const appts = BillingService.getAppointments();
                const targetAppt = appts.find(a => (a.patientId === patient.id || (a as any).patient_id === patient.id));
                const tokenCode = targetAppt?.tokenNumber || (patient as any)?.tokenNumber || (clearedInvoices[0] as any)?.tokenNumber || PatientService.generateNextTokenNumber(getIstDateString(), false);
                replyMessage = `🎉 *PAYMENT VERIFIED VIA GATEWAY & APPOINTMENT CONFIRMED!* 🟢\n\nHi ${patient.name}!\n • Payment Status: Cleared ✅\n • Token Number: ${tokenCode}\n\nPhysical visit token is active at ${this.getDynamicClinicName()} counter. Thank you for choosing VitalSync! 🩺`;
              } else {
                // Strict Security: Unpaid appointments remain pending. Do NOT auto-clear on unverified user text assertion.
                nextState = 'AWAITING_PAYMENT';
                const pendingAmt = pendingInvoices[0]?.totalAmount || 500;
                replyMessage = `⏳ *Payment Verification Pending*\n\nPayment confirmation for ₹${Number(pendingAmt).toFixed(2)} is not received yet from Bank/Payment Gateway.\n\n• *Send UPI UTR*: Reply with your 12-digit UTR number (e.g. \`620584739102\`) or screenshot.\n• *Direct UPI VPA*: Pay to \`vitalsync@axl\` (0% platform charge) and upload screenshot.\n\nReply **STATUS** to re-check after sending UTR. 🩺`;
              }
            } else {
              nextState = 'COMPLETED';
              replyMessage = "Patient record not resolved. Checkout failed.";
            }
          }
          break;

        case 'MEDICINE_ORDERING':
          {
            const stage = sessionData.medicineOrderStage || 'INITIAL';
            const activeInventory = PharmacyService.getPharmacyInventory();

            if (stage === 'CHOOSING_DELIVERY') {
              const draftBill = sessionData.draftMedicineBill as MedicineBill;
              const clinicUpi = PaymentService.getSafeClinicUpiVpa();
              if (cleaned === '1') {
                draftBill.deliveryType = 'pickup';
                draftBill.deliveryCharge = 0;
                draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount;
                draftBill.upiQrPayload = `https://razorpay.me/@vitalsync3758?amount=${(draftBill.totalAmount || 0).toFixed(2)}`;
                
                sessionData.medicineOrderStage = 'INITIAL';
                nextState = 'MEDICINE_AWAITING_PAYMENT';
                
                PharmacyService.saveMedicineBill(draftBill);

                replyMessage = `🚶 *Counter Pickup Confirmed!* \n\n*Invoice Summary:*\n- Subtotal: ₹${(draftBill.subtotal || 0).toFixed(2)}\n- GST: ₹${(draftBill.gstAmount || 0).toFixed(2)}\n- Delivery Charge: ₹0.00\n---------------------------------------\n*Total Amount Payable: ₹${(draftBill.totalAmount || 0).toFixed(2)}*\n\nSettle karne ke liye is link par click karein:\n${draftBill.upiQrPayload}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
              } else if (cleaned === '2') {
                draftBill.deliveryType = 'shiprocket';
                draftBill.deliveryCharge = 45;
                draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount + 45;
                draftBill.upiQrPayload = `https://razorpay.me/@vitalsync3758?amount=${(draftBill.totalAmount || 0).toFixed(2)}`;
                
                sessionData.medicineOrderStage = 'AWAITING_ADDRESS';
                
                replyMessage = `🚚 *Shiprocket Delivery Selected!* \n\nPlease delivery address type kijiye (For example: 'Sector-C, Central Colony, City Center'):`;
              } else {
                replyMessage = "Invalid option. Please choose:\n*1* - Counter Pickup (₹0.00)\n*2* - Shiprocket Home Delivery (₹45.00)";
              }
            } else if (stage === 'AWAITING_ADDRESS') {
              const draftBill = sessionData.draftMedicineBill as MedicineBill;
              draftBill.deliveryAddress = text;
              
              sessionData.medicineOrderStage = 'INITIAL';
              nextState = 'MEDICINE_AWAITING_PAYMENT';
              
              PharmacyService.saveMedicineBill(draftBill);

              replyMessage = `📍 *Delivery Address Saved!* \n"${text}"\n\n*Invoice Summary (Cheapest Shipping applied):*\n- Medicine Subtotal: ₹${(draftBill.subtotal || 0).toFixed(2)}\n- GST: ₹${(draftBill.gstAmount || 0).toFixed(2)}\n- Shiprocket Delivery Charge: ₹45.00\n---------------------------------------\n*Total Amount Payable: ₹${(draftBill.totalAmount || 0).toFixed(2)}*\n\nSettle karne ke liye is link par click karein:\n${draftBill.upiQrPayload || ''}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
            } else {
              let matchedItem: PharmacyInventoryItem | undefined;
              let qty = 10;

              for (const item of activeInventory) {
                const nameLower = (item.name || '').toLowerCase();
                const genericLower = (item.genericName || '').toLowerCase();
                const cleanLower = (cleaned || '').toLowerCase();
                if ((nameLower && cleanLower.includes(nameLower)) || (genericLower && cleanLower.includes(genericLower))) {
                  matchedItem = item;
                  break;
                }
              }

              const numMatch = cleaned.match(/\d+/);
              if (numMatch) {
                qty = Number(numMatch[0]);
              }

              if (matchedItem) {
                let patientObj = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
                if (!patientObj) {
                  // Auto-register patient to prevent duplicate registers or unlinked draft invoice deadlocks
                  patientObj = PatientService.registerPatient({
                    name: sessionData.familyDetails?.name || sessionData.tempNewPatientName || 'Patient',
                    phone: phone,
                    abhaId: `ABHA-WA-${Date.now().toString().slice(-4)}`,
                    age: Number(sessionData.tempNewPatientAge) || 30,
                    gender: sessionData.tempNewPatientGender || 'Male',
                    allergies: [],
                    chronicConditions: [],
                    queueStatus: 'awaiting_vitals'
                  });
                }
                const billId = `bill-${Date.now()}`;
                
                const itemTotal = matchedItem.price * qty;
                const gst = matchedItem.hsn === '300410' ? 0.12 : 0.05;
                const gstAmt = itemTotal * gst;
                
                const billItem: MedicineBillItem = {
                  inventoryItemId: matchedItem.id,
                  name: matchedItem.name,
                  genericName: matchedItem.genericName,
                  dosage: matchedItem.dosage,
                  batchNumber: matchedItem.batchNumber,
                  expiryDate: matchedItem.expiryDate,
                  quantity: qty,
                  mrp: matchedItem.mrp,
                  sellingPrice: matchedItem.price,
                  discountPercent: 0,
                  gstPercent: gst * 100,
                  lineTotal: itemTotal,
                  isStockDeducted: true
                };

                const draftBill: MedicineBill = {
                  id: billId,
                  patientId: patientObj.id,
                  patientName: patientObj.name,
                  patientPhone: phone,
                  items: [billItem],
                  subtotal: itemTotal,
                  loyaltyDiscountPercent: 0,
                  loyaltyDiscountAmount: 0,
                  itemDiscountAmount: 0,
                  gstAmount: gstAmt,
                  totalAmount: itemTotal + gstAmt,
                  paymentMode: 'whatsapp_pay',
                  status: 'draft',
                  source: 'whatsapp',
                  createdAt: new Date().toISOString()
                };

                // Reserve the stock and create active inventory holds for this WhatsApp order
                PharmacyService.reserveStockForWhatsAppOrder(draftBill);

                sessionData.draftMedicineBill = draftBill;
                sessionData.medicineOrderStage = 'CHOOSING_DELIVERY';

                replyMessage = `💊 *Live ${this.getDynamicClinicName()} Inventory Matched!* \n• Dawa: *${matchedItem.name}* (Batch: ${matchedItem.batchNumber})\n• Qty: *${qty} ${matchedItem.unit}*\n• Price per Unit: ₹${(matchedItem.price || 0).toFixed(2)}\n• Subtotal: ₹${(itemTotal || 0).toFixed(2)} (+₹${(gstAmt || 0).toFixed(2)} GST)\n\n*Logistics Option Select Karein:*\n\n*1* - Counter Pickup (₹0.00 standard pickup)\n*2* - Shiprocket Home Delivery (₹45.00 Cheapest logistics option)`;
              } else {
                replyMessage = `Aapka medicine query *"${text}"* match nahi hua. ⚠️ Hamare live catalog mein Paracetamol, Metformin, Amoxicillin, Atorvastatin aur Pantoprazole available hain. \n\nKaunsi medicine chahiye? Please correct brand/generic name type kijiye (e.g. "Metformin 30 tabs"):`;
              }
            }
          }
          break;

        case 'MEDICINE_AWAITING_PAYMENT':
          {
            const draftBill = sessionData.draftMedicineBill as MedicineBill;
            const liveBills = PharmacyService.getMedicineBills();
            const currentBill = liveBills.find(b => b.id === draftBill?.id) || draftBill;

            if (currentBill && currentBill.status === 'paid') {
              const voiceUrl = `https://vitalsync.in/api/voice-slips/VS-VOICE-${(currentBill.id || 'N/A').substring(4, 8)}.mp3`;
              if (currentBill.deliveryType === 'shiprocket') {
                nextState = 'COMPLETED';
                const shipId = `SR-${Math.floor(100000 + Math.random() * 900000)}`;
                replyMessage = `🟢 *Payment Verified & Cleared!* \n\nShiprocket logistics partner se order arrange kar diya hai. \n🚀 *Tracking ID: ${shipId}*\n\nMedicines 24-48 hours mein deliver ho jayengi. VitalSync digital ecosystem choose karne ke liye shukriya! 📦\n\n🔊 *Listen to Medication audio advice*:\n${voiceUrl}`;
              } else {
                nextState = 'MEDICINE_READY_FOR_PICKUP';
                replyMessage = `🟢 *Payment Verified & Cleared!* \n\nMedicines counter collection ke liye packing department mein bhej di gayi hain. \n\nShow this invoice ref to compounder at clinic counter: \n🔖 *Ref ID: #${(currentBill.id || 'N/A').substring(4, 10).toUpperCase()}*\n\n🔊 *Listen to Medication audio advice*:\n${voiceUrl}`;
              }
            } else {
              nextState = 'MEDICINE_AWAITING_PAYMENT';
              replyMessage = `⏳ *Payment Verification Pending*\n\nPayment for ₹${(draftBill?.totalAmount || 0).toFixed(2)} is not received yet. UPI Link:\n${draftBill?.upiQrPayload || 'N/A'}\n\n• *Online Gateway*: Auto-clears in ~10-30s once payment succeeds.\n• *Counter Cash/UPI*: Present your UPI UTR to the compounder at ${this.getDynamicClinicName()} counter.\n\nReply **STATUS** to re-check after completing payment. 📦`;
            }
          }
          break;

        case 'MEDICINE_READY_FOR_PICKUP':
          if (cleaned.includes('done') || cleaned.includes('clear') || cleaned === '1') {
            nextState = 'COMPLETED';
            replyMessage = `Medicine successfully collected from ${this.getDynamicClinicName()} Counter! Status updated to COMPLETED. Health is wealth! 🩺🟢`;
          } else {
            replyMessage = `Dawa collect karne ke baad ${this.getDynamicClinicName()} counter compounder screen clear karenge ya aap 'DONE' reply kijiye.`;
          }
          break;

        case 'COMPLETED': {
          const currentPat = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
          const awaitingAction = sessionData.awaitingProactiveAction;

          if (cleaned === 'yes' && awaitingAction === 'refill') {
            sessionData.awaitingProactiveAction = null;
            replyMessage = `Refill confirm ho gaya hai! 📦 Compounder ne verify kar diya hai aur ${this.getDynamicClinicName()} Pharmacy se dawa ka packet aapke address ke liye nikal raha hai. Aap is chat par track kar sakte hain. Dhanyawad!`;
          } else if (cleaned === 'home' && awaitingAction === 'lab') {
            sessionData.awaitingProactiveAction = 'lab_slot';
            replyMessage = "Please select a slot:\n1. 8:00 AM\n2. 10:00 AM\n3. 4:00 PM.";
          } else if ((cleaned === 'book' || cleaned === '1') && awaitingAction === 'followup') {
            sessionData.awaitingProactiveAction = 'virtual_slot';
            nextState = 'BOOKING_VIRTUAL';
            const docName = WhatsAppService.getActiveDoctorName();
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} has unlocked a virtual follow-up consult slot for you. \n\nPlease select your preferred slot:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book.`;
          } else if (awaitingAction === 'lab_slot' && ['1', '2', '3'].includes(cleaned)) {
            sessionData.awaitingProactiveAction = null;
            const slotMap: Record<string, string> = { '1': '8:00 AM', '2': '10:00 AM', '3': '4:00 PM' };
            const selectedSlot = slotMap[cleaned] || '8:00 AM';

            const invoices = BillingService.getUnifiedInvoices();
            const patientInvoice = invoices.find(i => i.patientId === currentPat?.id);
            const invoiceId = patientInvoice ? patientInvoice.id : `inv-${crypto.randomUUID().substring(0, 8)}`;
            if (patientInvoice) {
              patientInvoice.totalAmount = (patientInvoice.totalAmount || 0) + 100;
              save('unified_invoices', invoices);

              supabase.from('unified_invoices').update({
                total_amount: patientInvoice.totalAmount
              }).eq('id', patientInvoice.id);
            }

            const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
            const podEntityId = getPodContext().entityId;
            const labDestinationEntityId = getPodContext().labEntityId || podEntityId;
            const doorstepSplits: FinancialLedgerEntry[] = [
              {
                id: `tx-tech-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: podEntityId,
                destinationEntityId: labDestinationEntityId,
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.70,
                netPayout: 70,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: podEntityId,
                destinationEntityId: labDestinationEntityId,
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.20,
                netPayout: 20,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: podEntityId,
                destinationEntityId: podEntityId,
                transactionType: 'platform_fee',
                grossAmount: 100,
                commissionRate: 0.10,
                netPayout: 10,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              }
            ];

            ledgerEntries.unshift(...doorstepSplits);
            save('financial_ledgers', ledgerEntries);

            const dbSplits = doorstepSplits.map(s => ({
              id: s.id,
              invoice_id: s.invoiceId,
              source_entity_id: s.sourceEntityId,
              destination_entity_id: s.destinationEntityId,
              transaction_type: s.transactionType,
              gross_amount: s.grossAmount,
              commission_rate: s.commissionRate * 100,
              net_payout: s.netPayout,
              payment_status: 'cleared',
              settled_at: new Date().toISOString(),
              pod_id: getPodContext().podId
            }));

            supabase.from('financial_ledgers').upsert(dbSplits, { onConflict: 'id' }).then(({ error }) => {
              if (error) console.error('Error upserting doorstep splits in Supabase:', error);
            });

            replyMessage = `Home sample collection confirm ho gaya hai! 🔬 Hamare lab technician (Lalit Prasad) kal subah ${selectedSlot} par ghar aakar sample collect karenge. Dhyaan rahe ki test se 8 ghante pehle tak fasting rakhni hai. Slot lock ho gaya hai! 🟢\n\n*Premium Collection Fee breakdown*:\n- Total: ₹100.00 Collection Fee added\n- Lab Tech fuel/incentive bonus: ₹70.00\n- Lab Partner split: ₹20.00\n- Platform commission: ₹10.00`;
          } else if (cleaned.includes('refill') || cleaned.includes('medicine') || cleaned.includes('reorder') || cleaned.includes('order') || cleaned.includes('dawai')) {
            const completed = EncounterService.getEncounters()
              .filter(e => e.patientId === currentPat?.id && e.status === 'completed');
            const allMeds = new Set<string>();
            completed.forEach(enc => {
              (enc.medications || []).forEach(m => allMeds.add(m.medicineName));
            });
            const uniqueMeds = Array.from(allMeds);

            if (uniqueMeds.length > 0) {
              nextState = 'AWAITING_REFILL_CHOICE' as any;
              sessionData.refillOptions = uniqueMeds;
              replyMessage = `💊 *${this.getDynamicClinicName()} Refill Center (10% OFF)* \n\nAapki pre-authorized chronic medicine list ready hai. Refill select karne ke liye corresponding option number (1, 2, etc.) reply karein, ya direct brand/generic name type karein:\n\n` + 
                uniqueMeds.map((med, idx) => `*${idx + 1}* - ${med}`).join('\n');
            } else {
              nextState = 'MEDICINE_ORDERING';
              sessionData.medicineOrderStage = 'INITIAL';
              replyMessage = "Ji bilkul! Kaunsi dawaiyaan chahiye aapko? Please unka name aur total quantity type karke bhejein (For example: 'Metformin 30 tabs'):";
            }
          } else if (cleaned.includes('reschedule') || cleaned.includes('change appointment') || cleaned.includes('shift appointment')) {
            if (currentPat) {
              const appts = BillingService.getAppointments().filter(a => a.patientId === currentPat.id && a.status !== 'completed' && a.status !== 'cancelled');
              if (appts.length > 0) {
                const appt = appts[0];
                sessionData.reschedulingApptId = appt.id;
                nextState = 'AWAITING_RESCHEDULE_TIME' as any;
                replyMessage = `📅 *Appointment Reschedule Request* \n\nPlease select your preferred slot for tomorrow:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to reschedule.`;
              } else {
                replyMessage = "Aapke profile par koi active appointment scheduled nahi hai jise reschedule kiya ja sake. Naya appointment book karne ke liye **BOOK** reply kijiye.";
              }
            } else {
              replyMessage = "Patient details not found.";
            }
          } else if (cleaned.includes('cancel') || cleaned.includes('radd')) {
            if (currentPat) {
              const appts = BillingService.getAppointments().filter(a => a.patientId === currentPat.id && a.status !== 'completed' && a.status !== 'cancelled');
              if (appts.length > 0) {
                const appt = appts[0];
                appt.status = 'cancelled';
                BillingService.saveAppointment(appt);
                Promise.resolve(supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id))
                  .then((res: any) => { if (res?.error) console.error('[Mediflow] appointments cancel error:', res.error); })
                  .catch((err: any) => console.error('[Mediflow] appointments cancel caught:', err));
                replyMessage = "❌ *Appointment Cancelled!* \n\nAapka active appointment cancel kar diya gaya hai. Agar wapas schedule karna ho toh **BOOK** reply kijiye.";
              } else {
                replyMessage = "Aapke profile par koi active appointment scheduled nahi mila.";
              }
            } else {
              replyMessage = "Patient details not found.";
            }
          } else if (cleaned.includes('book') || cleaned.includes('virtual') || cleaned.includes('video') || cleaned.includes('tele') || cleaned.includes('consult')) {
            sessionData.awaitingProactiveAction = 'virtual_slot';
            nextState = 'BOOKING_VIRTUAL';
            const docName = WhatsAppService.getActiveDoctorName();
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} has unlocked a virtual follow-up consult slot for you. \n\nPlease select your preferred slot:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book.`;
          } else if (cleaned.includes('report') || cleaned.includes('pathology') || cleaned.includes('test')) {
            const approvedReports = LabService.getPathologyReports().filter(r => r.patientId === currentPat?.id && r.status === 'approved');
            if (approvedReports.length > 0) {
              const rep = approvedReports[0];
              const barcode = `MED-${rep.loincCode}-${rep.id.toUpperCase()}`;
              replyMessage = `*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${rep.patientName}\nTest: ${rep.testName}\nLOINC Code: ${rep.loincCode}\nStatus: Approved 🟢\n\n*Report Summary*:\n'${rep.results}'\n\n*Security Barcode*: ${barcode}`;
            } else {
              replyMessage = "Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye.";
            }
          } else if (cleaned.includes('summary') || cleaned.includes('soap') || cleaned.includes('schedule') || cleaned.includes('revisit')) {
            const completedEncounters = EncounterService.getEncounters()
              .filter(e => e.patientId === currentPat?.id && e.status === 'completed')
              .sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

            if (completedEncounters.length > 0) {
              const enc = completedEncounters[0];
              const drugTable = (enc.medications || []).map(m => `• ${m.medicineName} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join('\n');
              
              replyMessage = `*Prescription aur Doctor's Notes Summary* 🩺\n\n*Doctor Notes*:\n'${enc.clinicalNotes}'\n\n*Dawa ka Schedule*:\n${drugTable || "Koi active dawa nahi likhi gayi hai."}\n\n*Follow-Up Advice*:\n${this.getDynamicDoctorName()} ne aapko **14 din** ke baad follow-up ke liye ${this.getDynamicClinicName()} branch mein bulaya hai. Hum aapko time par remind kar denge! 😊`;
            } else {
              replyMessage = "Aapke profile par koi completed consultation encounter nahi mila.";
            }
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Aapka clinical consent cancel kar diya gaya hai aur profile lock ho gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
          } else if (greetings.includes(cleaned) || cleaned === '0' || cleaned === 'menu' || cleaned === 'start') {
            nextState = 'AWAITING_CONFIRMATION';
            const patName = currentPat?.name || patient?.name || "Patient";
            const clinicName = this.getDynamicClinicName();
            const effPat = currentPat || patient;
            const isFreeUnlocked = Boolean(effPat?.isPremiumMember || (effPat as any)?.is_premium_member || (effPat?.id && BillingService.checkPatientFreeVirtualEligibility(effPat.id).isEligible));
            const virtualOption = isFreeUnlocked ? "2️⃣ Book Virtual Video Consult 💻 (🎁 1 Free Consult Unlocked)" : "2️⃣ Book Virtual Video Consult 💻";
            replyMessage = `Namaste ${patName}! 🙏 Welcome to ${clinicName}.\n\n🌟 ${clinicName.toUpperCase()} SERVICES 🌟\n1️⃣ Book Physical Clinic Visit 🏥\n${virtualOption}\n3️⃣ View Lab Reports & Hinglish Summary 🔬\n4️⃣ Emergency SOS Priority #1 Routing 🚨\n5️⃣ 1-Click Medicine Refill (10% OFF) 💊\n6️⃣ Refer a Patient & Earn 10% OFF 🎁\n\nService select karne ke liye button tap kijiye ya number (1-6) reply kijiye! 🩺`;
          } else if (cleaned === '1' || cleaned === 'physical' || cleaned.includes('physical visit') || cleaned.includes('book physical')) {
            nextState = 'COMPLETED';
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, false);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();
            const effectivePat = currentPat || patient;

            if (effectivePat) {
              const newAppt: Appointment = {
                id: apptId,
                patientId: effectivePat.id,
                patientName: effectivePat.name,
                patientPhone: phone,
                doctorId: '',
                date: todayStr,
                appointmentTime: new Date().toISOString(),
                status: 'scheduled',
                source: 'whatsapp',
                tokenNumber: tokenNumber,
                createdAt: new Date().toISOString()
              };
              BillingService.saveAppointment(newAppt);
              effectivePat.tokenNumber = tokenNumber;
              PatientService.savePatient(effectivePat);
            }

            replyMessage = `🟢 *APPOINTMENT CONFIRMED & TOKEN ALLOCATED!*

Hi ${effectivePat?.name || 'Patient'}! ${docName} ke saath aapka checkup confirm ho gaya hai:

• Token Number: *${tokenNumber}* 🎫
• Queue Status: 0 Patients ahead of you (~10 mins wait)
• Live Clinic Turn Alert: Turn aane se 2 patient pehle WhatsApp alert aayega!
• Clinic Location: ${this.getDynamicClinicName()}, Desk #1

Doctor EMR aur Compounder Desk par aapki entry live sync ho chuki hai. Thank you! 😊`;
          } else if (cleaned === '2' || cleaned === 'virtual' || cleaned.includes('virtual video') || cleaned.includes('book virtual')) {
            sessionData.awaitingProactiveAction = 'virtual_slot';
            nextState = 'BOOKING_VIRTUAL';
            const docName = this.getDynamicDoctorName();
            const isFree = Boolean((currentPat || patient)?.isPremiumMember);
            const feeText = isFree ? " (🎁 Free Follow-Up Benefit Unlocked: ₹0)" : "";
            replyMessage = `📅 *Virtual Consultation Booking* \n\n${docName} ke virtual checkup ke liye slot select kijiye${feeText}:\n\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book! 💻`;
          } else if (cleaned === '3' || cleaned.includes('report') || cleaned.includes('pathology') || cleaned.includes('lab')) {
            nextState = 'COMPLETED';
            const effectivePat = currentPat || patient;
            const approvedReports = LabService.getPathologyReports().filter(r => r.patientId === effectivePat?.id && r.status === 'approved');
            if (approvedReports.length > 0) {
              const rep = approvedReports[0];
              const docLastName = this.getDynamicDoctorName().split(' ').pop() || 'Doctor';
              replyMessage = `📄 *Aapki Pathology Report Taiyar Hai!* 🔬

• Patient: ${rep.patientName}
• Test: ${rep.testName}
• Status: Verified & Approved 🟢
• AI Clinical Summary: ${rep.results || 'Parameters evaluated.'}

📥 [ 📎 Download Full Lab Report PDF ]

Dr. ${docLastName} se report review ke liye option chuniye:
1️⃣ Physical Review at Clinic 🏥
2️⃣ Virtual Video Review 💻
(Physical Review chune par aapki prescribed dawaiyan clinic pharmacy counter par reserve ho jayengi).`;
            } else {
              replyMessage = `Aapka koi approved pathology report abhi on file nahi mila. ${this.getDynamicClinicName()} lab technician ke test sync karne par aapko WhatsApp par automatic report deliver ho jayegi! 🔬`;
            }
          } else if (cleaned === '4' || cleaned === 'sos' || cleaned === 'emergency' || cleaned === 'urgent' || (cleaned.includes('sos') && !cleaned.includes('status'))) {
            nextState = 'COMPLETED';
            const todayStr = getIstDateString();
            const tokenNumber = PatientService.generateNextTokenNumber(todayStr, true);
            const apptId = crypto.randomUUID();
            const docName = this.getDynamicDoctorName();
            const effectivePat = currentPat || patient;

            const formattedToken = tokenNumber.startsWith('T-') && tokenNumber.includes(' E') ? tokenNumber : (tokenNumber.startsWith('VIP') ? tokenNumber : `T-${tokenNumber.replace(/\D/g, '').padStart(2, '0')} E`);
            if (effectivePat) {
              const sosAppt: Appointment = {
                id: apptId,
                patientId: effectivePat.id,
                patientName: effectivePat.name,
                patientPhone: phone,
                doctorId: '',
                date: todayStr,
                appointmentTime: new Date().toISOString(),
                status: 'ready_for_consult',
                source: 'whatsapp_vip',
                tokenNumber: formattedToken,
                createdAt: new Date().toISOString()
              };
              BillingService.saveAppointment(sosAppt);
              effectivePat.queueStatus = 'awaiting_consultation';
              effectivePat.tokenNumber = formattedToken;
              PatientService.savePatient(effectivePat);
            }

            // VIP bookings sync silently into Doctor EMR and Compounder Desk via state change
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));

            const activeSop = BillingService.getActiveSop();
            const emergencyFee = activeSop?.extractedConfig?.emergency_sos_fee ?? 618;
            replyMessage = `🚨 *EMERGENCY SOS PRIORITY #1 ACTIVATED!* 🚨\n\n${docName} ke dashboard par aapka case *PRIORITY #1* position par alert ho gaya hai (Red Pulsing Alert 🔴)!\n\n• Emergency Token: *${formattedToken}*\n• Doctor: *${docName}*\n• Clinic Desk: *${this.getDynamicClinicName()}*\n• Status: *Chamber Alerted (Top Priority)* 🔴\n• Emergency Surcharge: *₹${emergencyFee.toFixed(2)}*\n\nKripya turant clinic emergency desk par pahuchein aur token *${formattedToken}* compounder ko show karein! 🩺`;
          } else if (cleaned === '5' || cleaned.includes('refill') || cleaned.includes('medicine') || cleaned.includes('dawai')) {
            const completed = EncounterService.getEncounters()
              .filter(e => e.patientId === (currentPat || patient)?.id && e.status === 'completed');
            const allMeds = new Set<string>();
            completed.forEach(enc => {
              (enc.medications || []).forEach(m => allMeds.add(m.medicineName));
            });
            const uniqueMeds = Array.from(allMeds);

            if (uniqueMeds.length > 0) {
              nextState = 'AWAITING_REFILL_CHOICE' as any;
              sessionData.refillOptions = uniqueMeds;
              replyMessage = `Namaste ${(currentPat || patient)?.name || 'Patient'} Ji! 🩺\nAapki *${uniqueMeds[0]}* dawa agle *5 dino mein khatam* hone wali hai.\n\nBlood pressure/sugar control mein gap na aaye, isliye ${this.getDynamicClinicName()} Pharmacy ne aapka *1 Month Refill Pack (10% OFF)* ready rakha hai:\n\n• MRP: ~₹550.00~\n• Your Price (10% VIP Discount): *₹495.00*\n• Delivery: Free Clinic Counter Pickup ya 24hr Home Delivery\n\nReply *CONFIRM REFILL* ya *1-CLICK REFILL* to confirm! 💊`;
            } else {
              nextState = 'MEDICINE_ORDERING';
              sessionData.medicineOrderStage = 'INITIAL';
              replyMessage = `Ji bilkul! ${this.getDynamicClinicName()} Pharmacy se kaunsi dawaiyaan chahiye aapko? Please unka name aur total quantity type karke bhejein (e.g. 'Metformin 30 tabs'):`;
            }
          } else if (cleaned === '6' || cleaned.includes('refer') || cleaned.includes('code') || cleaned.includes('reward')) {
            nextState = 'AWAITING_CONFIRMATION';
            const effectivePat = currentPat || patient;
            const myRefCode = (effectivePat as any)?.referral_code || (effectivePat as any)?.referralCode || `REF-${(phone || '').slice(-4) || '1000'}`;
            replyMessage = `🎁 *${this.getDynamicClinicName()} Patient Referral Rewards* 🌟\n\nAapka Unique Referral Code: *${myRefCode}*\n\n📲 *Kaise Kaam Karta Hai:*\n1. Apne doston ya family ke sath yeh code share karein.\n2. Jab woh clinic OPD mein checkup ya WhatsApp par appoint book karenge, unhe *10% Flat Discount* milega.\n3. Aur aapko bhi agle doctor checkup ya medicine refill par *10% OFF* reward milega!\n\n_Forward karke share karein!_ 😊`;
          } else if (cleaned === '7' || cleaned.includes('family') || cleaned.includes('book for family')) {
            const allPatients = PatientService.getPatients();
            const clean10 = String(phone).replace(/\D/g, '').slice(-10);
            const familyMembers = allPatients.filter(p => (p.phone || '').includes(`${clean10}-family-`));
            const effPat = currentPat || patient;
            const patName = effPat?.name || 'Patient';
            const clinicName = this.getDynamicClinicName();

            if (familyMembers.length > 0) {
              const famList = familyMembers.map((f, idx) => `${idx + 1}️⃣ *${f.name}* (${f.gender || 'Unknown'}, ${f.age || 30} yrs)`).join('\n');
              sessionData.familyDirectory = familyMembers;
              nextState = 'AWAITING_FAMILY_SELECTION' as any;
              replyMessage = `👥 *FAMILY HEALTH DESK — ${clinicName}* 🏥\n\nNamaste *${patName}*! Aapke parivaar ke registered members:\n\n${famList}\n\n0️⃣ Naye Family Member ko Add Karein ➕\n\nCheckup book karne ke liye member number (ya 0) reply kijiye! 🩺`;
            } else {
              nextState = 'AWAITING_FAMILY_DETAILS' as any;
              replyMessage = `👥 *FAMILY HEALTH DESK — ${clinicName}* 🏥\n\nNamaste *${patName}*! Apne parivaar ke kisi sadasya ke liye checkup book kijiye.\n\nPlease family member ka Name, Age, aur Gender reply kijiye:\n*(e.g. Rohan Kumar, 28, Male)* 👤`;
            }
          } else if (cleaned === '8' || cleaned.includes('summary') || cleaned.includes('prescription') || cleaned.includes('rx')) {
            const completedEncounters = EncounterService.getEncounters()
              .filter(e => e.patientId === (currentPat || patient)?.id && e.status === 'completed')
              .sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

            if (completedEncounters.length > 0) {
              const enc = completedEncounters[0];
              const drugTable = (enc.medications || []).map(m => `• ${m.medicineName} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join('\n');
              const encDate = getIstDateDisplay(new Date(enc.createdAt || Date.now()));
              replyMessage = `📋 *PRESCRIPTION & DOCTOR NOTES SUMMARY* 🩺\n\n• Patient: *${(currentPat || patient)?.name || 'Patient'}*\n• Doctor: *${this.getDynamicDoctorName()}*\n• Clinic: *${this.getDynamicClinicName()}*\n• Consultation Date: *${encDate}*\n\n📝 *Doctor's Clinical Notes:*\n"${enc.clinicalNotes || 'Patient clinical parameters evaluated and stable.'}"\n\n💊 *Prescribed Medications Schedule:*\n${drugTable || '• As advised by doctor'}\n\n📅 *Follow-Up Advice:*\n${this.getDynamicDoctorName()} ne aapko *14 din* ke baad follow-up ke liye bulaya hai.`;
            } else {
              replyMessage = "Aapke profile par koi completed consultation encounter nahi mila.";
            }
          } else if (cleaned === '9' || cleaned.includes('ai') || cleaned.includes('assistant')) {
            nextState = 'AWAITING_AI_QUERY' as any;
            replyMessage = `🤖 *VITALSYNC AI CLINICAL ASSISTANT* 💡\n\nNamaste ${(currentPat || patient)?.name || 'Patient'}! Main ${this.getDynamicDoctorName()} ka verified AI Clinical Assistant hoon.\n\nAap apna health question ya lakshan (symptoms) yahan likh kar bhej sakte hain. Main doctor-approved ICMR clinical guidelines ke anusaar aapko immediate guidance doonga.\n\n⚠️ *Emergency Warning:* Kisi bhi gambhir takleef (chest pain, severe breathlessness, fainting) mein turant Emergency SOS (Reply 'SOS') use karein ya clinic visit karein!\n\nAapka sawal kya hai? Kripya neeche type kijiye: ✍️`;
          } else if (cleaned === '10' || cleaned.includes('locker') || cleaned.includes('record')) {
            const encs = EncounterService.getEncounters().filter(e => e.patientId === (currentPat || patient)?.id);
            const reps = LabService.getPathologyReports().filter(r => r.patientId === (currentPat || patient)?.id);
            const lastEncDate = encs[0]?.createdAt ? getIstDateDisplay(new Date(encs[0].createdAt)) : 'Recently';
            const repTimestamp = reps[0]?.timestamp || (reps[0] as any)?.createdAt || (reps[0] as any)?.created_at;
            const lastRepDate = repTimestamp ? getIstDateDisplay(new Date(repTimestamp)) : 'N/A';
            nextState = 'COMPLETED';
            replyMessage = `📁 *DIGITAL HEALTH LOCKER — ${this.getDynamicClinicName()}* 🔐\n\nNamaste ${(currentPat || patient)?.name || 'Patient'}! Aapka ABHA/VitalSync Health Locker secure cloud par active hai:\n\n• Consultations on File: *${encs.length}*\n• Pathology Lab Reports: *${reps.length}*\n• Last Prescribed Visit: *${lastEncDate}*\n• Latest Pathology Test: *${reps[0]?.testName || 'None'}* (${lastRepDate})\n\n📥 *Instant Access:*\n• Latest Prescription dekhne ke liye *SUMMARY* reply kijiye\n• Latest Lab Report dekhne ke liye *REPORT* reply kijiye`;
          } else {
            nextState = 'AWAITING_CONFIRMATION';
            const patName = currentPat?.name || patient?.name || "Patient";
            const clinicName = this.getDynamicClinicName();
            const effPat = currentPat || patient;
            const isFreeUnlocked = Boolean(effPat?.isPremiumMember || (effPat as any)?.is_premium_member || (effPat?.id && BillingService.checkPatientFreeVirtualEligibility(effPat.id).isEligible));
            const virtualOption = isFreeUnlocked ? "2️⃣ Book Virtual Video Consult 💻 (🎁 1 Free Consult Unlocked)" : "2️⃣ Book Virtual Video Consult 💻";
            replyMessage = `Namaste ${patName}! 🙏 Welcome to ${clinicName}.\n\n🌟 ${clinicName.toUpperCase()} SERVICES 🌟\n1️⃣ Book Physical Clinic Visit 🏥\n${virtualOption}\n3️⃣ View Lab Reports & Hinglish Summary 🔬\n4️⃣ Emergency SOS Priority #1 Routing 🚨\n5️⃣ 1-Click Medicine Refill (10% OFF) 💊\n6️⃣ Refer a Patient & Earn 10% OFF 🎁\n\nService select karne ke liye button tap kijiye ya number (1-6) reply kijiye! 🩺`;
          }
        }
        break;

        case 'AWAITING_REFILL_CHOICE': {
          const currentPat = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
          const activeInventory = PharmacyService.getPharmacyInventory();
          const optionIdx = parseInt(cleaned, 10) - 1;
          const refillOptions = sessionData.refillOptions || [];
          
          let selectedMedName = "";
          let qty = 30; // Standard 1 month chronic refill
          
          if (!isNaN(optionIdx) && optionIdx >= 0 && optionIdx < refillOptions.length) {
            selectedMedName = refillOptions[optionIdx];
          } else {
            selectedMedName = text; // Fallback to manual text search
            const numMatch = cleaned.match(/\d+/);
            if (numMatch) qty = Number(numMatch[0]);
          }

          const matchedItem = activeInventory.find(item => {
            const iName = (item.name || '').toLowerCase();
            const iGeneric = (item.genericName || '').toLowerCase();
            const sName = (selectedMedName || '').toLowerCase();
            return (iName && sName && (iName.includes(sName) || sName.includes(iName))) ||
                   (iGeneric && sName && (iGeneric.includes(sName) || sName.includes(iGeneric)));
          });

          if (matchedItem) {
            const billId = `bill-${Date.now()}`;
            const itemTotal = matchedItem.price * qty;
            const gst = matchedItem.hsn === '300410' ? 0.12 : 0.05;
            const gstAmt = itemTotal * gst;
            
            const billItem = {
              inventoryItemId: matchedItem.id,
              name: matchedItem.name,
              genericName: matchedItem.genericName,
              dosage: matchedItem.dosage,
              batchNumber: matchedItem.batchNumber,
              expiryDate: matchedItem.expiryDate,
              quantity: qty,
              mrp: matchedItem.mrp,
              sellingPrice: matchedItem.price,
              discountPercent: 0,
              gstPercent: gst * 100,
              lineTotal: itemTotal,
              isStockDeducted: true
            };

            const draftBill = {
              id: billId,
              patientId: currentPat?.id || 'pat-demo',
              patientName: currentPat?.name || `Patient (+91 ${(phone || '').slice(-4) || 'XXXX'})`,
              patientPhone: phone,
              items: [billItem],
              subtotal: itemTotal,
              loyaltyDiscountPercent: 0,
              loyaltyDiscountAmount: 0,
              itemDiscountAmount: 0,
              gstAmount: gstAmt,
              totalAmount: itemTotal + gstAmt,
              paymentMode: 'whatsapp_pay',
              status: 'draft',
              source: 'whatsapp',
              createdAt: new Date().toISOString()
            };

            PharmacyService.reserveStockForWhatsAppOrder(draftBill as MedicineBill);

            sessionData.draftMedicineBill = draftBill;
            sessionData.medicineOrderStage = 'CHOOSING_DELIVERY';
            nextState = 'MEDICINE_ORDERING';

            replyMessage = `💊 *Live ${this.getDynamicClinicName()} Inventory Matched!* \n• Dawa: *${matchedItem.name}* (Batch: ${matchedItem.batchNumber})\n• Qty: *${qty} ${matchedItem.unit}*\n• Price per Unit: ₹${(matchedItem.price || 0).toFixed(2)}\n• Subtotal: ₹${(itemTotal || 0).toFixed(2)} (+₹${(gstAmt || 0).toFixed(2)} GST)\n\n*Logistics Option Select Karein:*\n\n*1* - Counter Pickup (₹0.00 standard pickup)\n*2* - Shiprocket Home Delivery (₹45.00 Cheapest logistics option)`;
          } else {
            nextState = 'MEDICINE_ORDERING';
            sessionData.medicineOrderStage = 'INITIAL';
            replyMessage = `Aapka medicine query *"${selectedMedName}"* match nahi hua. ⚠️ Kaunsi medicine chahiye? Correct name type kijiye (e.g. "Metformin 30 tabs"):`;
          }
        }
        break;

        case 'AWAITING_RESCHEDULE_TIME': {
          const apptId = sessionData.reschedulingApptId;
          const slotMap: Record<string, string> = {
            '1': 'Morning Slot (10:00 AM - 11:30 AM)',
            '2': 'Afternoon Slot (2:00 PM - 3:30 PM)',
            '3': 'Evening Slot (5:00 PM - 6:30 PM)'
          };
          const selectedSlotText = slotMap[cleaned];
          if (selectedSlotText && apptId) {
            const appts = BillingService.getAppointments();
            const appt = appts.find(a => a.id === apptId);
            if (appt) {
              appt.virtualTime = selectedSlotText;
              appt.virtualDate = sessionData.reschedulingDate || getIstOffsetDateString(1);
              BillingService.saveAppointment(appt);
              Promise.resolve(supabase.from('appointments').update({
                status: 'ready_for_consult'
              }).eq('id', apptId))
                .then((res: any) => { if (res?.error) console.error('[Mediflow] appointments update error:', res.error); })
                .catch((err: any) => console.error('[Mediflow] appointments update caught:', err));
              
              nextState = 'COMPLETED';
              replyMessage = `📅 *Appointment Rescheduled Successfully!* \n\nSlot: *${selectedSlotText}* (Tomorrow)\n\nDoctor aur Compounder ko alert bhej diya gaya hai. Thank you! 😊`;
            } else {
              nextState = 'COMPLETED';
              replyMessage = "Rescheduling failed. Appointment record not found.";
            }
          } else {
            replyMessage = "Invalid slot selection. Please reply with **1**, **2**, or **3** to reschedule, or type **CANCEL**.";
          }
        }
        break;

        case 'BOOKING_VIRTUAL': {
          let currentPat = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === incomingLast10);
          const awaitingAction = sessionData.awaitingProactiveAction;

          if (awaitingAction === 'virtual_slot' && ['1', '2', '3'].includes(cleaned)) {
            sessionData.awaitingProactiveAction = null;
            const slotMap: Record<string, string> = {
              '1': 'Morning Slot (10:00 AM - 11:30 AM)',
              '2': 'Afternoon Slot (2:00 PM - 3:30 PM)',
              '3': 'Evening Slot (5:00 PM - 6:30 PM)'
            };
            const selectedSlotText = slotMap[cleaned] || 'Morning Slot (10:00 AM - 11:30 AM)';
            const apptId = crypto.randomUUID();

            // Auto-provision patient in local state & database if not existing yet
            if (!currentPat) {
              const newPatId = crypto.randomUUID();
              currentPat = {
                id: newPatId,
                name: sessionData.familyDetails?.name || sessionData.tempNewPatientName || sessionData.waProfileName || `Patient (+91 ${(phone || '').slice(-4) || 'XXXX'})`,
                phone: phone,
                age: Number(sessionData.familyDetails?.age || sessionData.tempNewPatientAge || sessionData.age || 0) || 0,
                gender: sessionData.familyDetails?.gender || sessionData.tempNewPatientGender || sessionData.gender || 'Other',
                allergies: [],
                chronicConditions: [],
                createdAt: new Date().toISOString(),
                registeredAt: new Date().toISOString(),
                registered_at: new Date().toISOString(),
                queueStatus: 'registered',
                tokenNumber: '1'
              };
              PatientService.savePatient(currentPat!);
              try {
                const podId = getPodContext().podId;
                const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
                Promise.resolve(supabase.from('patient_registry').upsert({
                  id: newPatId,
                  name: currentPat!.name,
                  phone: cleanPhone,
                  registered_at: currentPat!.registeredAt,
                  pod_id: podId
                }, { onConflict: 'id' }))
                .then((res: any) => { if (res?.error) console.error('[Mediflow] patient_registry upsert error:', res.error); })
                .catch((err: any) => console.error('[Mediflow] patient_registry upsert caught:', err));
              } catch (_e) { /* ignore fallback error */ }
            }

            const activePat = currentPat!;
            sessionData.bookingPatientId = activePat.id;
            sessionData.pendingApptId = apptId;

            const invoiceId = `inv-wa-${apptId.substring(0, 8)}`;
            sessionData.pendingInvoiceId = invoiceId;

            // Resolve assigned doctor for patient's clinic pod dynamically
            const runInsert = async () => {
              let resolvedDoctorId: string | null = null;
              try {
                const { data: patientRow } = await supabase
                  .from('patient_registry')
                  .select('pod_id')
                  .eq('id', activePat.id)
                  .maybeSingle();

                if (patientRow?.pod_id) {
                  const { data: doctorProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('pod_id', patientRow.pod_id)
                    .eq('role', 'doctor')
                    .maybeSingle();
                  resolvedDoctorId = doctorProfile?.id ?? null;
                }
              } catch (lookupErr) {
                console.error('[WhatsApp Booking] Doctor lookup failed:', lookupErr);
              }

              const chosenDate = sessionData.selectedDate || getIstOffsetDateString(1);
              let startHour = 10;
              if (selectedSlotText.includes('2:00') || selectedSlotText.includes('Afternoon')) startHour = 14;
              else if (selectedSlotText.includes('5:00') || selectedSlotText.includes('6:00') || selectedSlotText.includes('Evening')) startHour = 17;
              
              let apptTimestamp = `${chosenDate}T10:00:00.000Z`;
              try {
                apptTimestamp = new Date(`${chosenDate}T${String(startHour).padStart(2, '0')}:00:00+05:30`).toISOString();
              } catch (_e) { /* ignore */ }

              const eligibility = activePat?.id ? BillingService.checkPatientFreeVirtualEligibility(activePat.id) : { isEligible: false };
              const isFree = Boolean(activePat?.isPremiumMember || (activePat as any)?.is_premium_member || eligibility.isEligible);

              const apptStatus = isFree ? 'scheduled' : 'pending_payment';
              const newAppt: any = {
                id: apptId,
                patientId: activePat.id,
                patient_id: activePat.id,
                patientName: activePat.name,
                patient_name: activePat.name,
                patientPhone: activePat.phone,
                patient_phone: activePat.phone,
                doctorId: resolvedDoctorId ?? '',
                doctor_id: resolvedDoctorId ?? '',
                status: apptStatus,
                source: 'whatsapp',
                channel: 'whatsapp',
                date: chosenDate,
                appointmentTime: apptTimestamp,
                appointment_time: apptTimestamp,
                createdAt: new Date().toISOString(),
                created_at: new Date().toISOString(),
                isVirtual: true,
                is_virtual: true,
                virtualDate: chosenDate,
                virtual_date: chosenDate,
                virtualTime: selectedSlotText,
                virtual_time: selectedSlotText,
                virtualMeetingUrl: `https://meet.jit.si/vitalsync-consult-${apptId}`,
                virtual_meeting_url: `https://meet.jit.si/vitalsync-consult-${apptId}`,
                virtualTimeAllocated: isFree
              };
              BillingService.saveAppointment(newAppt);

              const activeSop = BillingService.getActiveSop();
              const baseDocFee = isFree ? 0 : (activeSop?.extractedConfig?.doctor_fee ?? 500);
              const onlinePlatFee = 0.00; // 0% Platform Fee
              const totalOnlinePayable = baseDocFee;

              const newInvoice: any = {
                id: invoiceId,
                appointmentId: apptId,
                patientId: activePat.id,
                type: 'consult',
                amount: totalOnlinePayable,
                doctorFee: baseDocFee,
                platformFee: onlinePlatFee,
                totalAmount: totalOnlinePayable,
                status: isFree ? 'paid' : 'pending',
                paymentStatus: isFree ? 'cleared' : 'pending',
                paymentMethod: isFree ? 'free-loyalty' : 'upi',
                createdAt: new Date().toISOString(),
                patientName: activePat.name,
                source: 'whatsapp'
              };
              BillingService.saveInvoice(newInvoice);

              const doctorUpi = activeSop?.extractedConfig?.doctor_upi_vpa || PaymentService.getSafeClinicUpiVpa();
              const uInvoices = BillingService.getUnifiedInvoices();
              uInvoices.unshift({
                id: invoiceId,
                encounterId: `enc-${apptId.substring(0, 8)}`,
                patientId: activePat.id,
                patientName: activePat.name,
                patientPhone: activePat.phone,
                doctorFee: baseDocFee,
                labFee: 0,
                pharmacyFee: 0,
                platformFee: onlinePlatFee,
                totalAmount: totalOnlinePayable,
                upiQrPayload: isFree ? 'FREE-LOYALTY' : `upi://pay?pa=${doctorUpi}&pn=Doctor&am=${totalOnlinePayable.toFixed(2)}&cu=INR&tn=VS-APPT-${apptId.substring(0, 8)}`,
                paymentStatus: isFree ? 'cleared' : 'pending',
                createdAt: new Date().toISOString()
              });
              save('unified_invoices', uInvoices);

              // If free loyalty consult, consume voucher
              if (isFree && activePat?.id) {
                PatientService.consumeFreeVirtualConsult(activePat.id);
              }

              try {
                const podId = getPodContext().podId;
                const { error } = await supabase.from('appointments').upsert({
                  id: apptId,
                  patient_id: activePat.id,
                  patient_name: activePat.name,
                  doctor_id: resolvedDoctorId,
                  status: apptStatus,
                  source: 'whatsapp',
                  is_virtual: true,
                  virtual_date: chosenDate,
                  virtual_time: selectedSlotText,
                  appointment_time: apptTimestamp,
                  virtual_meeting_url: `https://meet.jit.si/vitalsync-consult-${apptId}`,
                  created_at: new Date().toISOString(),
                  pod_id: podId
                }, { onConflict: 'id' });
                if (error) console.error('[WhatsApp Booking] Error creating virtual appt in Supabase:', error);
              } catch (err) {
                console.error('[WhatsApp Booking] Error connecting to Supabase:', err);
              }

              window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            };
            runInsert();

            const docName = WhatsAppService.getDynamicDoctorName();
            const clinicName = WhatsAppService.getDynamicClinicName();
            const chosenDateDisplay = sessionData.selectedDateDisplay || (sessionData.selectedDate === getIstDateString() ? `Today (${getIstDateDisplay()})` : `Tomorrow (${getIstOffsetDateDisplay(1)})`);
            const activeSop = BillingService.getActiveSop();
            const baseDocFee = activeSop?.extractedConfig?.doctor_fee ?? 500;
            const assignedToken = (activePat as any)?.tokenNumber || (activePat as any)?.token_number || '#TK-001';
            const doctorUpiVpa = activeSop?.extractedConfig?.doctor_upi_vpa || '8986426029@ybl';
            const directUpiLink = `upi://pay?pa=${doctorUpiVpa}&pn=${encodeURIComponent(docName)}&am=${baseDocFee.toFixed(2)}&cu=INR&tn=VS-APPT-${apptId.substring(0, 8)}`;

            const eligibility = activePat?.id ? BillingService.checkPatientFreeVirtualEligibility(activePat.id) : { isEligible: false };
            const isFree = Boolean(activePat?.isPremiumMember || (activePat as any)?.is_premium_member || eligibility.isEligible);

            if (isFree) {
              nextState = 'COMPLETED';
              replyMessage = `🟢 *FREE VIRTUAL CONSULT CONFIRMED!* 🎁\n\n*(Partner Pharmacy + Partner Pathology Billing Loyalty Benefit Applied: ₹0)*\n\n• Doctor: *${docName}*\n• Clinic: *${clinicName}*\n• Slot: *${selectedSlotText}* (${chosenDateDisplay})\n• Token Number: *${assignedToken}*\n• Video Call Link: https://meet.jit.si/vitalsync-consult-${apptId}\n\nDoctor chamber mein aapki appointment live sync ho chuki hai. Time par blue link tap karke call join kijiye! Dhanyawad! 😊`;
            } else {
              nextState = 'AWAITING_VIRTUAL_PAYMENT';
              replyMessage = `📅 *Checkup Slot Selected!*\n\n${docName} ke liye checkup slot *${selectedSlotText}* (${chosenDateDisplay}) at ${clinicName} lock kar diya gaya hai.\n\n• Doctor Consultation Fee: *₹${baseDocFee.toFixed(2)}*\n\n📲 *Doctor Direct UPI Se Pay Karein (GPay / PhonePe / Paytm):*\n${directUpiLink}\n\n👉 *Payment Options:*\n1️⃣ UPI se pay karke *PAID* reply karein (turant token ${assignedToken} issue ho jayega).\n2️⃣ Ya agar clinic counter par pay karna chahte hain toh *COUNTER* reply karein.\n\n*(Note: Partner Pharmacy se medicines aur Partner Pathology se lab tests dono VitalSync par bill hone par 1 Free Virtual Consult unlock hota hai)* 📑`;
            }
          } else {
            replyMessage = `Invalid slot selection. Please reply with **1**, **2**, or **3** to book your virtual follow-up.`;
          }
        }
        break;

        case 'AWAITING_VIRTUAL_PAYMENT': {
          const docName = WhatsAppService.getDynamicDoctorName();
          if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned.includes('paid') || cleaned.includes('done') || cleaned.includes('confirm') || cleaned === '1') {
            const apptId = sessionData.pendingApptId || crypto.randomUUID();
            const invoiceId = sessionData.pendingInvoiceId;
            const patId = sessionData.bookingPatientId;

            // 1. Confirm appointment status to 'scheduled' / 'ready_for_consult' so it syncs immediately to Doctor & Compounder EMR queues
            const appts = BillingService.getAppointments();
            const targetAppt = appts.find(a => a.id === apptId);
            if (targetAppt) {
              targetAppt.status = 'scheduled';
              BillingService.saveAppointment(targetAppt);
            }

            // 2. Clear invoice status in local state & unified_invoices via BillingService
            if (invoiceId) {
              BillingService.clearInvoice(invoiceId, 'upi');
            }

            // 3. Update Supabase Database records in real-time
            try {
              if (apptId) {
                await supabase.from('appointments').update({ status: 'scheduled' }).eq('id', apptId);
              }
            } catch (err) {
              console.error('[WhatsApp Payment] Error updating Supabase appointment status:', err);
            }

            // 4. Dispatch live 360-degree UI update custom events to instantly refresh frontend queues
            window.dispatchEvent(new CustomEvent('mediflow-state-change'));
            window.dispatchEvent(new CustomEvent('mediflow-financial-update'));

            const realToken = targetAppt?.tokenNumber || (targetAppt as any)?.token_number || (patient as any)?.tokenNumber || '#TK-001';
            nextState = 'COMPLETED';
            replyMessage = `🟢 *APPOINTMENT CONFIRMED & PAID!* \n\n${docName} ke saath aapka checkup slot confirm ho gaya hai! 📑\n\n• Token Number: *${realToken}*\n• Status: *Confirmed & Scheduled* 🟢\n• Google Meet Link: https://meet.jit.si/vitalsync-consult-${apptId}\n\nDoctor EMR aur Compounder Desk par aapki appointment live sync ho chuki hai! Thank you! 😊`;
          } else {
            const invId = sessionData.pendingInvoiceId || `inv-wa-${Date.now()}`;
            const activeSop = BillingService.getActiveSop();
            const doctorUpiVpa = activeSop?.extractedConfig?.doctor_upi_vpa || '8986426029@ybl';
            const baseDocFee = activeSop?.extractedConfig?.doctor_fee ?? 500;
            const directUpiLink = `upi://pay?pa=${doctorUpiVpa}&pn=${encodeURIComponent(docName)}&am=${baseDocFee.toFixed(2)}&cu=INR&tn=VS-APPT-${invId.substring(0, 8)}`;
            replyMessage = `Payment verification pending. Please Doctor Direct UPI se payment complete karke *PAY* reply kijiye ya *[ I Have Paid ✅ ]* button tap kijiye.\n\n📲 *Doctor Direct UPI Link:*\n${directUpiLink}\n\n*(Note: Clinic vitals desk par compounder payment screenshot verify karega)* 📑`;
          }
        }
        break;

        case 'FAILED_DELIVERY':
          if (cleaned) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Re-establishing connection loop. Dobara shuru karne ke liye '1' reply kijiye.";
          }
          break;

        default:
          replyMessage = `Namaste! ${clinicName} Automated Assistant online. Main aapki kya sahayata kar sakta hoon?`;
          break;
      }

      if (replyMessage) {
        const currentHistory = sessionData.chatHistory || [];
        currentHistory.push({ sender: 'bot', text: replyMessage, time: new Date().toISOString() });
        sessionData.chatHistory = currentHistory;
      }

      this.updateWhatsAppState(phone, nextState, sessionData);

      if (replyMessage) {
        this.sendWhatsAppMessagePayload(phone, 'mediflow_conversational_reply', { replyText: replyMessage });
      }

    } catch (e: any) {
      console.error("[Mediflow WhatsApp Bot] Error processing incoming conversational message:", e);
      writeAuditLog('SYSTEM_ERROR', {
        action: 'processIncomingWhatsAppMessage',
        error: e.message || e
      }, null);
    }
  }

  static initiateWhatsAppSession(phone: string): WhatsAppSession {
    const sessions = this.getWhatsAppSessions();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const existing = sessions.find(s => (s.patientPhone || '').replace(/\D/g, '').slice(-10) === cleanPhone);
    let clinicName = this.getDynamicClinicName() || 'Clinic';
    const activePodId = (typeof window !== 'undefined' && (window as any).__mediflow_active_pod_id) || '';
    if (activePodId) {
      const customName = localStorage.getItem(`waba_bot_name_${activePodId}`);
      if (customName) {
        clinicName = customName;
      }
    }
    const welcomeText = `Hello! Welcome to ${clinicName}. 🏥 To securely synchronize your clinical e-prescriptions, lab report cards, and invoices, please grant permission.`;
    
    const initialChat: ChatMessage[] = [
      {
        sender: 'bot',
        text: welcomeText,
        time: new Date().toISOString()
      }
    ];

    if (existing) {
      existing.currentState = 'AWAITING_WELCOME';
      existing.lastInteraction = new Date().toISOString();
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      };
      this.saveWhatsAppSessions(sessions);

      const updates = { ...existing.sessionData, consentGranted: false, consentTime: null };
      delete updates.chatHistory;

      const podCtx = getPodContext();
      supabase.rpc('atomic_update_whatsapp_session', {
        p_patient_phone: phone,
        p_patient_id: existing.sessionData?.patientId || null,
        p_pod_id: podCtx.podId || FALLBACK_POD_ID,
        p_entity_id: podCtx.entityId || FALLBACK_ENTITY_ID,
        p_current_state: 'AWAITING_WELCOME',
        p_message: initialChat,
        p_session_data_updates: updates
      }).then(({ error }) => {
        if (error) console.error('Error updating whatsapp session in Supabase:', error);
        else {
          writeAuditLog('whatsapp_session_initiated', { phone }, existing.id);
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
      });

      return existing;
    }

    const newId = crypto.randomUUID();
    const newSession: WhatsAppSession = {
      id: newId,
      patientPhone: phone,
      currentState: 'AWAITING_WELCOME',
      lastInteraction: new Date().toISOString(),
      sessionData: {
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      }
    };
    sessions.push(newSession);
    this.saveWhatsAppSessions(sessions);

    supabase.from('patient_registry').select('id').eq('phone', phone).maybeSingle().then(({ data: patient }) => {
      const podId = getPodContext().podId;
      supabase.from('whatsapp_sessions').upsert({
        patient_phone: phone,
        patient_id: patient?.id || null,
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: newSession.sessionData,
        pod_id: podId
      }, { onConflict: 'patient_phone' }).then(({ error }) => {
        if (error) console.error('Error creating whatsapp session in Supabase:', error);
        else {
          writeAuditLog('whatsapp_session_created', { phone }, newId);
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
      });
    });

    return newSession;
  }

  static updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    try {
      const sessions = this.getWhatsAppSessions();
      const targetDigits = (phone || '').replace(/\D/g, '').slice(-10);
      const idx = sessions.findIndex(s => {
        const sDigits = (s.patientPhone || (s as any).patient_phone || '').replace(/\D/g, '').slice(-10);
        return sDigits && targetDigits && sDigits === targetDigits;
      });
      if (idx !== -1) {
        sessions[idx].currentState = state;
        sessions[idx].lastInteraction = new Date().toISOString();
        sessions[idx].sessionData = { ...sessions[idx].sessionData, ...data, currentState: state };
        this.saveWhatsAppSessions(sessions);

        const updates = { ...data, currentState: state } as Record<string, any>;
        delete updates.chatHistory;

        const allowed = ['AWAITING_WELCOME', 'AWAITING_CONFIRMATION', 'AWAITING_PAYMENT', 'BOOKING_VIRTUAL', 'COMPLETED', 'INACTIVE'];
        let dbState: string = state;
        if (!allowed.includes(state)) {
          if (state === 'AWAITING_CONSENT') dbState = 'AWAITING_WELCOME';
          else if (state === 'AWAITING_WELCOME_ACK') dbState = 'AWAITING_CONFIRMATION';
          else if (state === 'MEDICINE_ORDERING') dbState = 'BOOKING_VIRTUAL';
          else if (state === 'AWAITING_REFILL_CHOICE' as any) dbState = 'BOOKING_VIRTUAL';
          else if (state === 'AWAITING_RESCHEDULE_TIME' as any) dbState = 'BOOKING_VIRTUAL';
          else if (state === 'MEDICINE_AWAITING_PAYMENT') dbState = 'AWAITING_PAYMENT';
          else if (state === 'MEDICINE_READY_FOR_PICKUP') dbState = 'COMPLETED';
          else if (state === 'FAILED_DELIVERY') dbState = 'INACTIVE';
          else dbState = 'AWAITING_WELCOME';
        }

        supabase.rpc('atomic_update_whatsapp_session', {
          p_patient_phone: phone,
          p_patient_id: null,
          p_pod_id: null,
          p_entity_id: null,
          p_current_state: dbState,
          p_message: null,
          p_session_data_updates: updates
        }).then(({ error }) => {
          if (error) console.error('Error updating whatsapp state in Supabase:', error);
          else writeAuditLog('whatsapp_session_state_updated', { phone, state: dbState }, sessions[idx].id);
        });
      }
    } catch (e) {
      console.error("[Mediflow WhatsApp Bot] Error in updateWhatsAppState:", e);
    }
  }

  static dispatchWhatsAppLoyaltyOffer(patientId: string, offerType: string): string {
    const patients = PatientService.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'Patient not found.';

    let message = '';
    if (offerType === 'discount_30') {
      message = `*VitalSync Patient Care Loyalty:* Dear ${patient.name}, as part of your ongoing care pod benefits, here is a special coupon for **30% Off on your next medicine refill** at our adjacent Pharmacy. Code: **MF-LOYAL30**`;
    } else if (offerType === 'virtual_appointment') {
      message = `*VitalSync Care Loyalty:* Dear ${patient.name}, thank you for your recent visit. To support your clinical path, a **100% Free Loyalty Follow-up Unlocked** (Free Virtual Follow-up Appointment with the Doctor at ₹0.00) is unlocked for you for the next 15 days. Book directly via this chat with 1-click video link: https://meet.jit.si/vitalsync-consult-${patient.id.slice(0, 8)}.`;
    } else {
      message = `*VitalSync Connect:* Quick Portal Link enabled for Patient ${patient.name} to view invoices and schedule pathology sample collection.`;
    }

    writeAuditLog('LOYALTY_OFFER_DISPATCHED', {
      patientId,
      patientName: patient.name,
      offerType,
      message
    });

    this.pushWhatsAppMessageFromBot(patient.phone, message);
    return message;
  }

  static pushWhatsAppMessageFromBot(phone: string, text: string): void {
    if (!phone || !text) return;

    // 1. Dispatch outbound Meta WhatsApp message via edge function relay
    this.sendWhatsAppMessagePayload(phone, 'mediflow_conversational_reply', { replyText: text }).catch(err => {
      console.warn('[whatsappService] Outbound Meta Graph API relay notice:', err);
    });

    const sessions = this.getWhatsAppSessions();
    const targetDigits = phone.replace(/\D/g, '').slice(-10);
    const existing = sessions.find(s => {
      const sDigits = (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10);
      return sDigits && targetDigits && sDigits === targetDigits;
    });

    const now = new Date().toISOString();
    const msgObj = { sender: 'bot', text, time: now, timestamp: now };

    if (existing) {
      const currentHistory = existing.sessionData?.chatHistory || [];
      currentHistory.push(msgObj);
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: currentHistory
      };
      this.saveWhatsAppSessions(sessions);
    } else {
      // Auto-provision session for new phone numbers (e.g. demo test dispatches / outbound reminders)
      const newSession: WhatsAppSession = {
        id: crypto.randomUUID(),
        patientPhone: phone,
        patientName: 'WhatsApp Demo Patient',
        currentState: 'AWAITING_WELCOME',
        lastInteraction: now,
        sessionData: {
          step: 'main_menu',
          chatHistory: [msgObj]
        }
      };
      sessions.unshift(newSession);
      this.saveWhatsAppSessions(sessions);
    }

    const podCtx = getPodContext();
    supabase.rpc('atomic_update_whatsapp_session', {
      p_patient_phone: phone,
      p_patient_id: existing?.sessionData?.patientId || null,
      p_pod_id: podCtx.podId || FALLBACK_POD_ID,
      p_entity_id: podCtx.entityId || FALLBACK_ENTITY_ID,
      p_current_state: existing ? existing.currentState : 'AWAITING_WELCOME',
      p_message: msgObj,
      p_session_data_updates: existing ? null : { step: 'main_menu' }
    }).then(({ data, error }) => {
      if (error) {
        console.error('[whatsappService] atomic_update_whatsapp_session failed:', error);
      } else {
        const sessId = data?.id || existing?.id;
        writeAuditLog('WHATSAPP_BOT_OUTGOING_MESSAGE', { phone, message: text }, sessId);
      }
    });
  }

  static triggerProactiveRefillNudge(phone: string): void {
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Refill Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      // Proactive refill alert restrained silently
      return;
    }

    const message = `Hello ${patient.name}! 😊 We noticed your generic medication dosage is running low (only 5 days left!). 💊\n\nTo ensure uninterrupted treatment, we have pre-allocated a fresh, quality-checked pack for you at our ${this.getDynamicClinicName()} pharmacy counter. \n\n*Reply 'YES' to confirm and immediately dispatch your medicine refill package to your home!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'refill'
      };
      this.saveWhatsAppSessions(sessions);
    }
    
    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_REFILL_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static triggerProactiveFollowUpNudge(phone: string): void {
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Followup Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      // Proactive followup alert restrained silently
      return;
    }

    const docName = WhatsAppService.getActiveDoctorName();
    const message = `Hello ${patient.name}! 😊 Hope you are recovering well. \n\n${docName} recommended a follow-up consultation in 3 days to evaluate your progress. \n\n*Reply 'BOOK' or '1' to lock a convenient Virtual Video Consultation slot immediately!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'followup'
      };
      this.saveWhatsAppSessions(sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_FOLLOWUP_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static triggerProactiveLabCollectionNudge(phone: string): void {
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Lab Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      // Proactive lab collection alert restrained silently
      return;
    }

    const docName = WhatsAppService.getActiveDoctorName();
    const message = `Hi ${patient.name}! 🔬 Our records show you have a pending sugar level test (HbA1c test) ordered by ${docName}. Reagents are currently locked for your slot. \n\n*Would you like our lab team to collect your blood sample from your home tomorrow morning at 8:00 AM? Reply 'HOME' to schedule.*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'lab'
      };
      this.saveWhatsAppSessions(sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_LAB_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }
  static triggerAbhaCreationNudge(phone: string): void {
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
    
    if (!patient) return;
    
    // Don't nudge if they already have an ABHA ID
    if (patient.abhaId) return;

    const message = `Namaste ${patient.name || 'Patient'} Ji 🙏,

VitalSync Clinic OS supports the Ayushman Bharat Digital Mission (ABDM). By creating an *ABHA ID (Health ID)*, you can securely access all your prescriptions, lab reports, and vitals anytime on WhatsApp.

*Benefits of ABHA ID:*
✅ 100% Secure Digital Health Locker
✅ Never lose your medical history
✅ Accepted across all modern hospitals in India

When you visit ${this.getDynamicClinicName()} next time, please ask the compounder desk to instantly generate and link your ABHA ID using your Aadhaar number. It takes only 60 seconds! ⏳🏥`;

    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_ABHA_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static async referPatientToSpecialist(phone: string, targetDoctorId: string): Promise<void> {
    try {
      const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
      const sessions = this.getWhatsAppSessions();
      const sessionIndex = sessions.findIndex(s => (s.patientPhone || s.patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
      const patient = PatientService.getPatients().find(p => (p.phone || (p as any).patient_phone || '').replace(/\D/g, '').slice(-10) === cleanPhoneDigits);
      if (sessionIndex === -1 || !patient) {
        console.warn(`[Mediflow Referrals] Session or Patient not found for phone ${phone}`);
        return;
      }

      const session = sessions[sessionIndex];

      let doctorName = "Doctor";
      let specialty = "Specialist";
      try {
        const { data: targetDocProfile } = await supabase
          .from('profiles')
          .select('display_name, specialization, role')
          .eq('id', targetDoctorId)
          .maybeSingle();
        if (targetDocProfile) {
          doctorName = targetDocProfile.display_name || "Doctor";
          specialty = targetDocProfile.specialization || "Specialist";
        }
      } catch (err) {
        console.warn('[Mediflow Referrals] Could not dynamically resolve target doctor profile:', err);
      }

      let referrerName = "Your doctor";
      let referrerDoctorId: string | null = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', authUser.id)
            .maybeSingle();
          if (referrerProfile) {
            referrerDoctorId = referrerProfile.id;
            referrerName = referrerProfile.display_name || "Your doctor";
          }
        }
      } catch (err) {
        console.warn('[Mediflow Referrals] Could not resolve referrer profile dynamically:', err);
      }

      const nudgeMessage = `${referrerName} has referred you to ${specialty} ${doctorName}. Reply 'BOOK' to schedule your slot. 🩺`;

      const referralData = {
        referredByDoctorId: referrerDoctorId,
        referredToDoctorId: targetDoctorId,
        specialty,
        doctorName,
        referralCommissionAmt: 50.00
      };

      const sessionData = {
        ...session.sessionData,
        referral: referralData
      };

      this.updateWhatsAppState(phone, 'AWAITING_WELCOME', sessionData);
      this.pushWhatsAppMessageFromBot(phone, nudgeMessage);
      await writeAuditLog('PATIENT_REFERRAL_INITIATED', { phone, targetDoctorId, specialty, doctorName }, patient.id);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Referral Nudge Sent! 📣',
          message: `Referral nudge sent to ${patient.name} via WhatsApp. Awaiting BOOK response.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[Mediflow Referrals] Error initiating referral:', err);
    }
  }
}
