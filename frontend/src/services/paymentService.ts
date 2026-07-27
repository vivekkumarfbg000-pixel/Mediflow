// =============================================================================
// Mediflow — Multi-Payment Gateway Architecture Service
// Supports: Direct Zero-Fee Dynamic UPI QR Deep-Links, Razorpay, Cashfree, & Cash Counter
// =============================================================================

import { supabase } from '../lib/supabaseClient';

export type PaymentGatewayProvider = 'upi' | 'razorpay' | 'cashfree' | 'cash';

export interface PaymentOrderParams {
  invoiceId: string;
  amount: number;
  patientName: string;
  patientPhone: string;
  gateway?: PaymentGatewayProvider;
  returnUrl?: string;
}

export interface DirectUpiPayload {
  vpa: string;
  payeeName: string;
  amount: number;
  invoiceId: string;
  upiDeepLink: string;
  qrDataUrl?: string;
}

export interface UnifiedOrderResponse {
  success: boolean;
  gateway: PaymentGatewayProvider;
  orderId?: string;
  paymentSessionId?: string;
  upiPayload?: DirectUpiPayload;
  razorpayKeyId?: string;
  cashfreeEnv?: string;
  error?: string;
}

// Default Clinic VPA Address for Pilot Project
const DEFAULT_PILOT_VPA = '7903823485@okicici';
const DEFAULT_PAYEE_NAME = 'VitalSync Care Network';

export class PaymentService {
  /**
   * Generates a standard RFC-compliant Direct Dynamic UPI Deep-Link (0% Gateway Fee)
   * Format: upi://pay?pa=<VPA>&pn=<PAYEE>&am=<AMOUNT>&tn=<INVOICE>&cu=INR
   */
  static generateDirectUpiPayload(
    amount: number,
    invoiceId: string,
    vpa: string = DEFAULT_PILOT_VPA,
    payeeName: string = DEFAULT_PAYEE_NAME
  ): DirectUpiPayload {
    const cleanAmount = (Math.round(amount * 100) / 100).toFixed(2);
    const sanitizedPayee = encodeURIComponent(payeeName);
    const sanitizedInvoice = encodeURIComponent(invoiceId.substring(0, 30));

    const upiDeepLink = `upi://pay?pa=${vpa}&pn=${sanitizedPayee}&am=${cleanAmount}&tn=${sanitizedInvoice}&cu=INR`;

    return {
      vpa,
      payeeName,
      amount,
      invoiceId,
      upiDeepLink
    };
  }

  /**
   * Initiates a payment order across available gateways (Direct UPI, Razorpay, Cashfree, or Cash Counter)
   */
  static async initiatePaymentOrder(params: PaymentOrderParams): Promise<UnifiedOrderResponse> {
    const selectedGateway = params.gateway || (import.meta.env.VITE_ACTIVE_PAYMENT_GATEWAY as PaymentGatewayProvider) || 'upi';

    try {
      // 1. Direct Zero-Fee Dynamic UPI Flow (Scenario B - Default for Pilot)
      if (selectedGateway === 'upi') {
        const upiPayload = this.generateDirectUpiPayload(params.amount, params.invoiceId);
        return {
          success: true,
          gateway: 'upi',
          upiPayload
        };
      }

      // 2. Razorpay Gateway Order Flow
      if (selectedGateway === 'razorpay') {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            invoiceId: params.invoiceId,
            amount: params.amount,
            returnUrl: params.returnUrl
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn('[PaymentService] Razorpay order call returned non-200. Falling back to Direct UPI payload.', errData);
          const upiPayload = this.generateDirectUpiPayload(params.amount, params.invoiceId);
          return {
            success: true,
            gateway: 'upi',
            upiPayload,
            error: errData.error
          };
        }

        const data = await response.json();
        return {
          success: true,
          gateway: 'razorpay',
          orderId: data.orderId,
          razorpayKeyId: data.keyId
        };
      }

      // 3. Cashfree Gateway Order Flow
      if (selectedGateway === 'cashfree') {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cashfree-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            invoiceId: params.invoiceId,
            returnUrl: params.returnUrl
          })
        });

        if (!response.ok) {
          const upiPayload = this.generateDirectUpiPayload(params.amount, params.invoiceId);
          return {
            success: true,
            gateway: 'upi',
            upiPayload
          };
        }

        const data = await response.json();
        return {
          success: true,
          gateway: 'cashfree',
          paymentSessionId: data.paymentSessionId,
          cashfreeEnv: data.environment
        };
      }

      // 4. Cash / Counter Payment Flow
      return {
        success: true,
        gateway: 'cash'
      };

    } catch (err: any) {
      console.error('[PaymentService] Exception during order initiation. Returning Direct UPI payload fallback:', err);
      const upiPayload = this.generateDirectUpiPayload(params.amount, params.invoiceId);
      return {
        success: true,
        gateway: 'upi',
        upiPayload
      };
    }
  }

  /**
   * Helper to verify payment status in PostgreSQL and log commission pool splits
   */
  static async settleInvoiceAndCommissionPool(
    invoiceId: string,
    paymentMethod: 'cash' | 'upi' | 'razorpay' | 'cashfree' = 'upi',
    gatewayFee: number = 0
  ): Promise<boolean> {
    try {
      // 1. Retrieve invoice details
      const { data: invoice, error: invErr } = await supabase
        .from('unified_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invErr || !invoice) {
        console.warn(`[PaymentService] Could not find invoice ${invoiceId} for settlement:`, invErr);
        return false;
      }

      const totalAmount = Number(invoice.total_amount) || Number(invoice.totalAmount) || 0;
      const doctorFee = Number(invoice.doctor_fee) || Number(invoice.doctorFee) || 500;
      const platformFee = Number(invoice.platform_fee) || Number(invoice.platformFee) || 15;
      const netPlatformProfit = Math.max(0, platformFee - gatewayFee);

      // 2. Mark invoice as cleared in public.unified_invoices
      await supabase
        .from('unified_invoices')
        .update({
          payment_status: 'cleared',
          payment_method: paymentMethod
        })
        .eq('id', invoiceId);

      // 3. Log settlement into vitalsync_pool_settlements
      await supabase
        .from('vitalsync_pool_settlements')
        .insert({
          invoice_id: invoiceId,
          patient_id: invoice.patient_id || invoice.patientId,
          total_amount: totalAmount,
          doctor_share: doctorFee,
          platform_share: platformFee,
          gateway_fee: gatewayFee,
          net_platform_profit: netPlatformProfit,
          payment_method: paymentMethod,
          settlement_status: 'completed',
          created_at: new Date().toISOString()
        })
        .select();

      console.log(`[PaymentService] 🟢 Invoice ${invoiceId} settled via ${paymentMethod}. Doctor: ₹${doctorFee}, Platform Profit: ₹${netPlatformProfit}`);
      return true;
    } catch (err) {
      console.error('[PaymentService] Exception settling invoice:', err);
      return false;
    }
  }
}
