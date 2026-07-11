import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { getPodContext } from './podContext';
import type { LabTestBill, LabTestBillItem, FinancialLedgerEntry } from '../types';

/**
 * LabBillingService — Creates, manages, and settles itemized lab test bills.
 * Mirrors the PharmacyService.saveMedicineBill() pattern for pathology.
 *
 * Data flow:
 *   Doctor submits encounter → EncounterService creates LabRequisitions
 *   → Lab tech groups requisitions per patient → generates LabTestBill
 *   → Collects payment → Sends invoice to patient via WhatsApp
 */
export class LabBillingService {

  // ── CRUD ────────────────────────────────────────────────────────────────────

  static getLabTestBills(): LabTestBill[] {
    return load<LabTestBill[]>('lab_test_bills', []);
  }

  static saveLabTestBill(bill: LabTestBill): LabTestBill {
    // Ensure UUID-format ID
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(bill.id)) {
      bill.id = crypto.randomUUID();
    }

    const bills = this.getLabTestBills();
    const existsIndex = bills.findIndex(b => b.id === bill.id);
    if (existsIndex >= 0) {
      bills[existsIndex] = bill;
    } else {
      bills.push(bill);
    }
    save('lab_test_bills', bills);
    notify();
    writeAuditLog('lab_test_bill_saved', { billId: bill.id, total: bill.totalAmount, patientName: bill.patientName }, bill.patientId);

    // Sync to Supabase
    if (navigator.onLine) {
      const ctx = getPodContext();
      supabase.from('lab_test_bills').upsert({
        id: bill.id,
        patient_id: bill.patientId,
        encounter_id: bill.encounterId || null,
        lab_entity_id: ctx.labEntityId || null,
        subtotal: bill.subtotal,
        discount_amount: bill.discountAmount || 0,
        gst_amount: bill.gstAmount || 0,
        total_amount: bill.totalAmount,
        payment_mode: bill.paymentMode || 'cash',
        status: bill.status || 'draft',
        source: bill.source || 'encounter',
        pod_id: ctx.podId
      }).then(({ error }) => {
        if (error) {
          console.error('[LabBillingService] Error saving lab test bill to Supabase:', error);
        } else {
          // Sync line items: delete old, insert new
          supabase.from('lab_test_bill_items').delete().eq('bill_id', bill.id).then(({ error: delErr }) => {
            if (delErr) console.error('[LabBillingService] Error clearing old bill items:', delErr);
            if (bill.items && bill.items.length > 0) {
              const dbItems = bill.items.map(item => ({
                bill_id: bill.id,
                requisition_id: item.requisitionId || null,
                loinc_code: item.loincCode,
                test_name: item.testName,
                price: item.price,
                discount_percent: item.discountPercent || 0,
                gst_percent: item.gstPercent || 0,
                line_total: item.lineTotal
              }));
              supabase.from('lab_test_bill_items').insert(dbItems).then(({ error: insErr }) => {
                if (insErr) console.error('[LabBillingService] Error inserting bill items:', insErr);
              });
            }
          });
        }
      });
    }

    return bill;
  }

  static getLabTestBillById(id: string): LabTestBill | null {
    return this.getLabTestBills().find(b => b.id === id) || null;
  }

  static updateLabTestBillStatus(id: string, status: LabTestBill['status']): void {
    const bills = this.getLabTestBills();
    const bill = bills.find(b => b.id === id);
    if (bill) {
      bill.status = status;
      save('lab_test_bills', bills);
      notify();
      writeAuditLog('lab_test_bill_status_updated', { billId: id, status }, bill.patientId);

      if (navigator.onLine) {
        supabase.from('lab_test_bills').update({ status, updated_at: new Date().toISOString() })
          .eq('id', id).then(({ error }) => {
            if (error) console.error('[LabBillingService] Error updating bill status:', error);
          });
      }
    }
  }

  // ── Payment Collection ──────────────────────────────────────────────────────

  static payLabTestBill(id: string, paymentMethod: 'cash' | 'upi' | 'card' = 'cash'): void {
    const bills = this.getLabTestBills();
    const billIndex = bills.findIndex(b => b.id === id);
    if (billIndex < 0) return;

    const bill = bills[billIndex];
    bill.status = 'paid';
    bill.paymentMode = paymentMethod;
    bills[billIndex] = bill;
    save('lab_test_bills', bills);
    notify();
    writeAuditLog('lab_test_bill_paid', { billId: id, method: paymentMethod, total: bill.totalAmount }, bill.patientId);

    // Sync to Supabase
    if (navigator.onLine) {
      supabase.from('lab_test_bills').update({
        status: 'paid',
        payment_mode: paymentMethod,
        updated_at: new Date().toISOString()
      }).eq('id', id).then(({ error }) => {
        if (error) console.error('[LabBillingService] Error marking bill paid in Supabase:', error);
      });
    }

    // Create financial ledger splits
    const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
    const exists = ledgerEntries.some(l => l.invoiceId === id);
    if (!exists) {
      const splitPlat = 3; // 3% platform fee for lab
      const amount = bill.totalAmount;
      const platformAmt = parseFloat((amount * (splitPlat / 100)).toFixed(2));
      const labAmt = parseFloat((amount - platformAmt).toFixed(2));

      const platformLedger: FinancialLedgerEntry = {
        id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: id,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'platform-admin-entity',
        transactionType: 'platform_fee',
        grossAmount: amount,
        commissionRate: splitPlat / 100,
        netPayout: platformAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const labLedger: FinancialLedgerEntry = {
        id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
        invoiceId: id,
        sourceEntityId: 'clinic-admin-entity',
        destinationEntityId: 'lab-partner-entity',
        transactionType: 'lab_commission',
        grossAmount: amount,
        commissionRate: 1 - splitPlat / 100,
        netPayout: labAmt,
        paymentStatus: 'cleared',
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      ledgerEntries.unshift(platformLedger, labLedger);
      save('financial_ledgers', ledgerEntries);

      // Sync splits to Supabase
      if (navigator.onLine) {
        const dbEntries = [
          {
            invoice_id: id.length === 36 ? id : null,
            source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
            destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
            transaction_type: 'platform_fee',
            gross_amount: amount,
            commission_rate: splitPlat,
            net_payout: platformAmt,
            payment_status: 'cleared',
            settled_at: new Date().toISOString()
          },
          {
            invoice_id: id.length === 36 ? id : null,
            source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
            destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
            transaction_type: 'lab_commission',
            gross_amount: amount,
            commission_rate: 100 - splitPlat,
            net_payout: labAmt,
            payment_status: 'cleared',
            settled_at: new Date().toISOString()
          }
        ];
        supabase.from('financial_ledgers').insert(dbEntries).then(({ error }) => {
          if (error) console.error('[LabBillingService] Error inserting ledger splits:', error);
        });
      }
    }
  }

  // ── Invoice HTML Generation ─────────────────────────────────────────────────

  static generateLabInvoiceHtml(bill: LabTestBill): string {
    const rows = bill.items.map(item =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${item.testName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-family:monospace">${item.loincCode}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0f172a">₹${item.price.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b">${item.discountPercent > 0 ? item.discountPercent + '%' : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a">₹${item.lineTotal.toFixed(2)}</td>
      </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Lab Test Invoice — ${bill.patientName}</title>
  <style>
    body { font-family: 'Inter', 'Segoe UI', sans-serif; margin: 40px; color: #0f172a; }
    h1 { color: #106675; margin-bottom: 4px; font-size: 22px; }
    .clinic-name { font-size: 14px; color: #64748b; margin-bottom: 20px; }
    .meta { color: #94a3b8; font-size: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; }
    .patient-info { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
    .patient-info strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 10px 12px; background: #106675; color: white; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .totals tr td { padding: 6px 12px; font-size: 13px; }
    .totals tr td:last-child { text-align: right; font-weight: 600; }
    .totals .grand-total td { font-size: 16px; font-weight: 800; color: #106675; border-top: 2px solid #106675; padding-top: 10px; }
    .payment-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .payment-badge.unpaid { background: #f59e0b; color: #1e293b; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>🧪 Pathology Lab Invoice</h1>
  <p class="clinic-name">VitalSync Connected Care Ecosystem</p>

  <div class="meta">
    <span>Invoice #${bill.id.substring(0, 8).toUpperCase()}</span>
    <span>${new Date(bill.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
  </div>

  <div class="patient-info">
    <strong>Patient:</strong> ${bill.patientName} &nbsp;|&nbsp;
    <strong>Phone:</strong> +91 ${bill.patientPhone} &nbsp;|&nbsp;
    <strong>Source:</strong> ${bill.source === 'walkin' ? 'Walk-in' : 'Doctor Prescription'}
    ${bill.labGstin ? `&nbsp;|&nbsp; <strong>Lab GSTIN:</strong> ${bill.labGstin}` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>LOINC Code</th>
        <th>Price</th>
        <th>Discount</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>₹${bill.subtotal.toFixed(2)}</td></tr>
    ${bill.discountAmount > 0 ? `<tr><td>Discount</td><td>-₹${bill.discountAmount.toFixed(2)}</td></tr>` : ''}
    ${bill.gstAmount > 0 ? `<tr><td>GST</td><td>₹${bill.gstAmount.toFixed(2)}</td></tr>` : ''}
    <tr class="grand-total"><td>Total Amount</td><td>₹${bill.totalAmount.toFixed(2)}</td></tr>
  </table>

  <p>
    <span class="payment-badge ${bill.status === 'paid' ? '' : 'unpaid'}">
      ${bill.status === 'paid' ? '✓ PAID' : '⚠ UNPAID'} — ${bill.paymentMode?.toUpperCase() || 'PENDING'}
    </span>
  </p>

  <div class="footer">
    This is a computer-generated invoice. No signature required.<br/>
    Powered by VitalSync Connected Care Ecosystem • For queries: support@vitalsync.in
  </div>
</body>
</html>`;
  }

  // ── WhatsApp Invoice Message ────────────────────────────────────────────────

  static generateLabInvoiceMessage(bill: LabTestBill): string {
    const itemsList = bill.items.map(item =>
      `• ${item.testName} (${item.loincCode}) — ₹${item.lineTotal.toFixed(2)}`
    ).join('\n');

    const discountText = bill.discountAmount > 0
      ? `\n🎉 Discount Applied: -₹${bill.discountAmount.toFixed(2)}`
      : '';

    const gstText = bill.gstAmount > 0
      ? `\n📋 GST: ₹${bill.gstAmount.toFixed(2)}`
      : '';

    return `🧪 *Lab Test Invoice — VitalSync Pathology*\n\n` +
      `👤 *Patient:* ${bill.patientName}\n` +
      `📱 *Phone:* +91 ${bill.patientPhone}\n` +
      `📄 *Invoice:* #${bill.id.substring(0, 8).toUpperCase()}\n` +
      `📅 *Date:* ${new Date(bill.createdAt).toLocaleString('en-IN')}\n\n` +
      `*Tests:*\n${itemsList}\n\n` +
      `💰 Subtotal: ₹${bill.subtotal.toFixed(2)}` +
      discountText +
      gstText +
      `\n\n✅ *Grand Total: ₹${bill.totalAmount.toFixed(2)}*\n` +
      `💳 Payment Mode: ${bill.paymentMode?.toUpperCase() || 'PENDING'}\n` +
      `📊 Status: ${bill.status === 'paid' ? '✓ PAID' : '⚠ UNPAID'}\n\n` +
      `_Thank you for choosing VitalSync Connected Care!_`;
  }

  // ── Send Invoice to Patient (WhatsApp) ──────────────────────────────────────

  static sendLabInvoiceToPatient(bill: LabTestBill): void {
    const invoiceText = this.generateLabInvoiceMessage(bill);

    // Push to local WhatsApp session
    const sessions = load<any[]>('whatsapp_sessions', []);
    const session = sessions.find(s => s.patientPhone === bill.patientPhone);
    if (session) {
      const currentHistory = session.sessionData?.chatHistory || [];
      currentHistory.push({
        sender: 'bot',
        text: invoiceText,
        time: new Date().toISOString()
      });
      session.sessionData = { ...session.sessionData, chatHistory: currentHistory };
      save('whatsapp_sessions', sessions);

      // Sync to Supabase
      if (navigator.onLine) {
        supabase.from('whatsapp_sessions').update({
          session_data: session.sessionData,
          last_interaction: new Date().toISOString()
        }).eq('patient_phone', bill.patientPhone).then(({ error }) => {
          if (error) console.error('[LabBillingService] Error syncing WhatsApp session:', error);
        });
      }
    }

    writeAuditLog('lab_invoice_sent_whatsapp', { billId: bill.id, patientPhone: bill.patientPhone }, bill.patientId);
    notify();
  }
}
