import { BillingService } from './billingService';
import { WhatsAppService } from './whatsappService';
import { load } from './apiHelper';

export class FinancialAuditService {
  /**
   * Runs the automated Financial Sentinel audit.
   * Cross-references appointments vs unified_invoices to detect revenue leakage.
   */
  public static async runNightlyAudit(): Promise<{ totalCollected: number, leakageAmount: number, discrepancies: string[] }> {
    const todayISO = new Date().toISOString().slice(0, 10);
    const allAppointments = BillingService.getAppointments().filter(a => (a.createdAt || '').slice(0, 10) === todayISO);
    const allInvoices = load<any[]>('unified_invoices', []).filter((i: any) => (i.createdAt || '').slice(0, 10) === todayISO);
    const allPharmacyHolds = load<any[]>('inventory_holds', []).filter((h: any) => (h.createdAt || '').slice(0, 10) === todayISO);
    
    let totalCollected = 0;
    let leakageAmount = 0;
    const discrepancies: string[] = [];

    // 1. Audit Consultation Fee Leakage
    // Every completed/confirmed appointment should have a corresponding cleared invoice
    const activeSop = BillingService.getActiveSop();
    const docFee = activeSop?.extractedConfig?.doctor_fee ?? 500;

    for (const appt of allAppointments) {
      if (appt.status === 'cancelled') continue;

      const matchingInvoice = allInvoices.find(i => i.patientId === appt.patientId && (i.doctorFee > 0 || i.type === 'consult'));
      
      if (!matchingInvoice || (matchingInvoice.paymentStatus !== 'cleared' && matchingInvoice.paymentStatus !== 'paid')) {
        leakageAmount += docFee;
        discrepancies.push(`Missing consult fee (₹${docFee}) for Token ${appt.tokenNumber || 'Walk-in'} (${appt.patientName})`);
      }
    }

    // 2. Audit Pharmacy Inventory Shrinkage
    // Every inventory hold (dispensed medicine) should have a cleared invoice with pharmacyFee > 0
    for (const hold of allPharmacyHolds) {
      const matchingInvoice = allInvoices.find(i => i.patientId === hold.patientId && i.pharmacyFee > 0);
      if (!matchingInvoice || (matchingInvoice.paymentStatus !== 'cleared' && matchingInvoice.paymentStatus !== 'paid')) {
        discrepancies.push(`Missing pharmacy billing for ${hold.quantity}x ${hold.medicineName} (${hold.patientName})`);
      }
    }

    // Calculate total actual collected today
    for (const inv of allInvoices) {
      if (inv.paymentStatus === 'cleared' || inv.paymentStatus === 'paid') {
        totalCollected += (inv.totalAmount || 0);
      }
    }

    // 3. Dispatch WhatsApp Audit Report to Admin/Doctor
    const adminPhone = "+919999999999"; // In production, read from clinic_sops owner_phone
    
    let auditMsg = `📊 *VITALSYNC NIGHTLY FINANCIAL AUDIT*\nDate: ${todayISO}\n\n`;
    auditMsg += `💰 Total Revenue Cleared: *₹${totalCollected}*\n`;
    
    if (discrepancies.length > 0) {
      auditMsg += `\n🚨 *${discrepancies.length} DISCREPANCIES DETECTED (Leakage: ₹${leakageAmount})*\n`;
      discrepancies.forEach((d, i) => {
        auditMsg += `${i + 1}. ${d}\n`;
      });
      auditMsg += `\nAction Required: Please review the Billing Hub to reconcile these missing payments.`;
    } else {
      auditMsg += `\n✅ Zero Revenue Leakage Detected. 100% Reconciliation matched!`;
    }

    WhatsAppService.pushWhatsAppMessageFromBot(adminPhone, auditMsg);
    console.log('[FinancialAudit] Nightly audit dispatched to Admin WhatsApp.');

    return { totalCollected, leakageAmount, discrepancies };
  }
}
