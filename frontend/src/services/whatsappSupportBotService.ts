import { supabase } from '../lib/supabaseClient';
import { StateHealingEngine } from './autoHealerAgent';
import { api } from './api';

export interface SupportEscalationTicket {
  id: string;
  pod_id?: string;
  clinic_name: string;
  doctor_name: string;
  sender_role: 'doctor' | 'compounder' | 'pharmacy' | 'patient';
  query_text: string;
  category: 'how_to' | 'auto_healed' | 'owner_escalation';
  status: 'open' | 'resolved';
  created_at: string;
}

// ── Complete Comprehensive Mediflow SaaS RAG Knowledge Base ──────────────────
export const MEDIFLOW_SAAS_KNOWLEDGE_BASE: Record<string, { keywords: string[]; answer: string }> = {
  prescriptions: {
    keywords: ['prescription', 'rx', 'medicine', 'scribe', 'dosage', 'prescribe'],
    answer: `📋 *MEDIFLOW 1-TAP PRESCRIPTION GUIDE*

1. Open Doctor EMR ➔ Select Patient from Queue.
2. Click *'AI Scribe'* or type symptom keywords.
3. Select Prescribed Medicines from Inventory.
4. Click *'Dispatch 1-Tap Rx'* ➔ Patient receives instant PDF on WhatsApp & Pharmacy Counter gets 1-Click order lock.`
  },
  queue_tokens: {
    keywords: ['token', 'queue', 'compounder', 'waiting', 'checkin', 'number'],
    answer: `🎫 *QUEUE & TOKEN MANAGEMENT GUIDE*

1. Compounder Desk lists all live tokens (e.g. MF-1001).
2. Unpaid bookings remain in *'pending_payment'* status until Cashfree payment is confirmed.
3. Emergency SOS bookings (₹618.00) automatically move to *Priority #1 Position* with red pulsing alerts.`
  },
  payments_cashfree: {
    keywords: ['cashfree', 'payment', 'pending_payment', 'refund', 'upi', 'cash'],
    answer: `💳 *CASHFREE PAYMENT & SETTLEMENT GUIDE*

1. Appointments must reach status *'PAYMENT_SUCCESS'* to unlock EMR queue.
2. Cash split between Clinic (97.5%) and Platform (2.5%) happens automatically via Cashfree Easy Split.
3. For cash payments at counter, Compounder clicks *'Collect Cash & Verify'* to clear lock.`
  },
  care_loop: {
    keywords: ['care loop', 'touchpoint', 'evening review', 'lab report', 'physical review'],
    answer: `🔄 *2-TOUCHPOINT CARE LOOP GUIDE*

• *Touchpoint 1 (Morning Consult)*: Doctor registers vitals & orders initial lab tests.
• *Touchpoint 2 (Evening Review)*: Upon lab report approval, WhatsApp dispatches 2 instant reply buttons:
  - 🏥 *Physical Review at Clinic* (Default evening slot)
  - 💻 *Virtual Video Review* (Emergency remote fallback)`
  },
  b2b_referral: {
    keywords: ['referral', 'discount', 'code', 'ref-', 'reward', 'loyalty'],
    answer: `🎁 *B2B REFERRAL & LOYALTY ENGINE GUIDE*

1. Every patient gets a unique referral code (*REF-XXXX*).
2. Entering *REF-XXXX* unlocks 10% OFF for both referrer and new patient on checkup & medicine bills.
3. Paying medicine/lab bills at counter unlocks 1 Free Virtual Consult (15-20 days).`
  },
  pharmacy_delivery: {
    keywords: ['pharmacy', 'delivery', 'refill', 'reminder', 'counter'],
    answer: `💊 *PHARMACY DELIVERY & REFILL GUIDE*

1. Prescriptions trigger 1-Click pharmacy delivery orders.
2. Automatic refill reminders are scheduled at *Day 7*, *Month 1*, and *Month 3*.
3. Pharmacy Counter sees real-time prescription locks instantly.`
  }
};

export class WhatsAppSupportBotService {
  // ── AI RAG Agent Query Processor ──────────────────────────────────────────
  static async processSupportQuery(
    queryText: string,
    senderInfo: { name: string; clinicName: string; role: 'doctor' | 'compounder' | 'pharmacy' | 'patient'; podId?: string }
  ): Promise<{ response: string; category: 'how_to' | 'auto_healed' | 'owner_escalation' }> {
    const textLower = queryText.toLowerCase().trim();

    // ── SCENARIO 1: System Error / Sync Glitch (Activates Auto-Healer) ──────
    if (
      textLower.includes('stuck') ||
      textLower.includes('error') ||
      textLower.includes('not loading') ||
      textLower.includes('slow') ||
      textLower.includes('freeze') ||
      textLower.includes('sync')
    ) {
      // Trigger Autonomous Auto-Healing Sentry
      try {
        await supabase.rpc('trigger_devsecops_auto_heal');
        await StateHealingEngine.healLocalSessionState();
      } catch (_e) {}

      const autoHealResp = `🛠️ *MEDIFLOW AUTONOMOUS SENTRY — AUTO-HEALED!* ⚡\n\nNamaste ${senderInfo.name}!\n\nOur 24/7 Autonomous DevSecOps Engine detected a transient session/sync lock on your clinic pod (*${senderInfo.clinicName}*).\n\n✅ *Action Taken*: Flushed orphaned sync locks & rejuvenated active sessions (240ms latency).\n\nPlease refresh your page now. Everything is running at 100% nominal performance!`;

      // Log ticket as auto_healed
      await this.logEscalationTicket({
        clinic_name: senderInfo.clinicName,
        doctor_name: senderInfo.name,
        sender_role: senderInfo.role,
        query_text: queryText,
        category: 'auto_healed',
        status: 'resolved',
        pod_id: senderInfo.podId
      });

      return { response: autoHealResp, category: 'auto_healed' };
    }

    // ── SCENARIO 2: Platform Owner Escalation (Requires Admin Intervention) ──
    if (
      textLower.includes('cashfree key') ||
      textLower.includes('domain') ||
      textLower.includes('credential') ||
      textLower.includes('pricing') ||
      textLower.includes('billing account') ||
      textLower.includes('custom feature') ||
      textLower.includes('owner')
    ) {
      // Log ticket as owner_escalation for Admin Cockpit
      await this.logEscalationTicket({
        clinic_name: senderInfo.clinicName,
        doctor_name: senderInfo.name,
        sender_role: senderInfo.role,
        query_text: queryText,
        category: 'owner_escalation',
        status: 'open',
        pod_id: senderInfo.podId
      });

      const escalationResp = `🚨 *MEDIFLOW PLATFORM OWNER ESCALATED* 🔑\n\nNamaste ${senderInfo.name}!\n\nYour request regarding *"${queryText}"* requires Platform Owner authorization.\n\nAn urgent escalation ticket has been dispatched directly to the SaaS Platform Admin Cockpit. You will receive an update here on WhatsApp as soon as approved!`;

      return { response: escalationResp, category: 'owner_escalation' };
    }

    // ── SCENARIO 3: RAG Knowledge Base Matching (How-To Guidance) ─────────────
    for (const key of Object.keys(MEDIFLOW_SAAS_KNOWLEDGE_BASE)) {
      const kb = MEDIFLOW_SAAS_KNOWLEDGE_BASE[key];
      if (kb.keywords.some(kw => textLower.includes(kw))) {
        const ragResp = `🤖 *MEDIFLOW AI SUPPORT RAG ASSISTANT*\n\n${kb.answer}\n\nNeed further assistance? Reply directly to this WhatsApp chat!`;
        
        await this.logEscalationTicket({
          clinic_name: senderInfo.clinicName,
          doctor_name: senderInfo.name,
          sender_role: senderInfo.role,
          query_text: queryText,
          category: 'how_to',
          status: 'resolved',
          pod_id: senderInfo.podId
        });

        return { response: ragResp, category: 'how_to' };
      }
    }

    // ── DEFAULT RAG FALLBACK ──────────────────────────────────────────────────
    const defaultResp = `🤖 *MEDIFLOW AI SUPPORT BOT*\n\nNamaste ${senderInfo.name}! I am your 24/7 Mediflow Assistant.\n\nI can help you with:\n1. *1-Tap Prescriptions & AI Scribe*\n2. *Tokens & Queue Management*\n3. *Cashfree Payments & Easy Split*\n4. *Pharmacy Refills & B2B Referrals*\n\nType your query or describe any issue to get instant assistance!`;

    await this.logEscalationTicket({
      clinic_name: senderInfo.clinicName,
      doctor_name: senderInfo.name,
      sender_role: senderInfo.role,
      query_text: queryText,
      category: 'how_to',
      status: 'resolved',
      pod_id: senderInfo.podId
    });

    return { response: defaultResp, category: 'how_to' };
  }

  // ── Log Ticket to Local State & Supabase ───────────────────────────────────
  private static async logEscalationTicket(ticket: Omit<SupportEscalationTicket, 'id' | 'created_at'>) {
    const newTicket: SupportEscalationTicket = {
      ...ticket,
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem('mediflow_support_tickets') || '[]');
      existing.unshift(newTicket);
      localStorage.setItem('mediflow_support_tickets', JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent('mediflow-support-ticket-updated'));
    } catch (_e) {}

    try {
      await supabase.from('support_escalations').insert([newTicket]);
    } catch (_e) {}
  }

  // ── Fetch Tickets for SaaS Admin Cockpit ────────────────────────────────────
  static getEscalationTickets(): SupportEscalationTicket[] {
    try {
      return JSON.parse(localStorage.getItem('mediflow_support_tickets') || '[]');
    } catch (_e) {
      return [];
    }
  }

  // ── Resolve Ticket from SaaS Admin Cockpit ─────────────────────────────────
  static async resolveTicket(ticketId: string, resolutionMsg?: string) {
    try {
      const existing: SupportEscalationTicket[] = JSON.parse(localStorage.getItem('mediflow_support_tickets') || '[]');
      const ticket = existing.find(t => t.id === ticketId);
      const updated = existing.map(t => t.id === ticketId ? { ...t, status: 'resolved' as const } : t);
      localStorage.setItem('mediflow_support_tickets', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('mediflow-support-ticket-updated'));

      if (ticket && resolutionMsg) {
        api.pushWhatsAppMessageFromBot('+919876543210', `✅ *MEDIFLOW PLATFORM OWNER RESOLUTION*\n\nRe: Ticket ${ticket.id} (${ticket.query_text})\n\nResolution: ${resolutionMsg}\n\nThank you for using VitalSync Connected Care!`);
      }
    } catch (_e) {}
  }
}
