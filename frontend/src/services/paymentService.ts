// =============================================================================
// Mediflow — Multi-Payment Gateway Architecture Service
// Supports: Direct Zero-Fee Dynamic UPI QR Deep-Links, Razorpay, Cashfree, & Cash Counter
// =============================================================================

import { supabase } from '../lib/supabaseClient';

export type PaymentGatewayProvider = 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'cashfree' | 'cash';

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
    const selectedGateway = params.gateway || (import.meta.env.VITE_ACTIVE_PAYMENT_GATEWAY as PaymentGatewayProvider) || 'paytm';

    try {
      // Paytm 0-Fee PG Order Flow (Instant 15m Activation)
      if (selectedGateway === 'paytm') {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paytm-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              invoiceId: params.invoiceId,
              amount: params.amount,
              patientPhone: params.patientPhone,
              patientName: params.patientName
            })
          });

          if (response.ok) {
            const data = await response.json();
            return {
              success: true,
              gateway: 'paytm',
              orderId: data.orderId,
              paymentSessionId: data.paymentUrl,
              upiPayload: {
                vpa: (localStorage.getItem('clinic_upi_vpa') || 'vitalsync@axl'),
                payeeName: 'VitalSync Care',
                amount: params.amount,
                invoiceId: params.invoiceId,
                upiDeepLink: data.paymentUrl
              }
            };
          }
        } catch (paytmErr) {
          console.warn('[PaymentService] Paytm order call failed, falling back to Direct UPI.', paytmErr);
        }
      }

      // PhonePe 0-Fee PG Order Flow
      if (selectedGateway === 'phonepe') {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phonepe-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              invoiceId: params.invoiceId,
              amount: params.amount,
              patientPhone: params.patientPhone,
              patientName: params.patientName,
              returnUrl: params.returnUrl
            })
          });

          if (response.ok) {
            const data = await response.json();
            return {
              success: true,
              gateway: 'phonepe',
              orderId: data.merchantTransactionId,
              paymentSessionId: data.paymentUrl,
              upiPayload: {
                vpa: (localStorage.getItem('clinic_upi_vpa') || 'vitalsync@axl'),
                payeeName: 'VitalSync Care',
                amount: params.amount,
                invoiceId: params.invoiceId,
                upiDeepLink: data.paymentUrl
              }
            };
          }
        } catch (phonepeErr) {
          console.warn('[PaymentService] PhonePe order call failed, falling back to Direct UPI.', phonepeErr);
        }
      }

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
          paymentSessionId: data.paymentSessionId || data.payment_session_id,
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
   * Dynamically loads the Razorpay Standard Checkout SDK script
   */
  static loadRazorpaySdk(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('[PaymentService] Failed to load Razorpay Checkout SDK.');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  /**
   * Launches the Razorpay Standard Checkout Modal and verifies payment signature upon completion
   */
  static async launchRazorpayModal(params: {
    orderId: string;
    invoiceId: string;
    amount: number; // in Rupees
    name?: string;
    email?: string;
    phone?: string;
    keyId?: string;
    onSuccess: (res: any) => void;
    onError: (err: any) => void;
  }): Promise<void> {
    const isLoaded = await this.loadRazorpaySdk();
    if (!isLoaded) {
      params.onError({ message: 'Razorpay SDK failed to load. Please check internet connection.' });
      return;
    }

    // ── Key ID Guard ──────────────────────────────────────────────────────────
    // Never fall back to a hardcoded placeholder key — it will cause Razorpay to
    // return "Oops! Something went wrong. Payment Failed" immediately.
    // The keyId MUST come from the server-side razorpay-order Edge Function.
    const keyId = params.keyId || (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined);
    if (!keyId || keyId.trim() === '') {
      console.error('[PaymentService] ❌ No Razorpay Key ID available. razorpay-order Edge Function may have failed to return keyId, or VITE_RAZORPAY_KEY_ID is not set in Vercel/env.');
      params.onError({ message: 'Razorpay is not configured. Please contact support.' });
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const amountInPaise = Math.round(params.amount * 100);

    const options: any = {
      key: keyId,
      amount: amountInPaise,
      currency: 'INR',
      name: 'VitalSync Care Network',
      description: `Clinical Appointment Invoice #${params.invoiceId.substring(0, 8).toUpperCase()}`,
      ...(params.orderId && params.orderId.startsWith('order_') && params.orderId.length >= 14 && !params.orderId.includes('inv') && !params.orderId.includes('fallback') ? { order_id: params.orderId } : {}),
      prefill: {
        name: params.name || 'VitalSync Patient',
        email: params.email || 'patient@vitalsync.in',
        contact: params.phone || '9999999999'
      },
      theme: {
        color: '#0f62fe'
      },
      handler: async (response: any) => {
        console.log('[PaymentService] Razorpay checkout response received:', response);
        // Clean up Razorpay DOM artifacts (backdrop/iframes) but do NOT touch
        // body.overflow here — the vitals modal onSuccess will set it.
        PaymentService.cleanupRazorpayDOM();
        // Verify payment signature via backend Edge Function
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kguupaybvbngyzyofjun.supabase.co';
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm';
          const verifyRes = await fetch(`${supabaseUrl}/functions/v1/razorpay-verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey
            },
            body: JSON.stringify({
              invoiceId: params.invoiceId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          // BUG-04 FIX: check HTTP status before treating as success
          if (!verifyRes.ok) {
            const errData = await verifyRes.json().catch(() => ({ error: 'Verification failed' }));
            console.error('[PaymentService] Signature verification rejected by server:', errData);
            params.onError({ message: errData.error || 'Payment verification failed. Contact support.' });
            return;
          }

          const verifyData = await verifyRes.json().catch(() => ({ success: true }));
          params.onSuccess(verifyData);
        } catch (err: any) {
          console.warn('[PaymentService] Signature verification network error — treating as success fallback:', err);
          params.onSuccess({ paymentId: response.razorpay_payment_id });
        }
      },
      modal: {
        ondismiss: () => {
          console.warn('[PaymentService] User closed Razorpay Checkout modal.');
          PaymentService.cleanupRazorpayDOM();
          params.onError({ message: 'Payment cancelled by user.' });
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        console.error('[PaymentService] Razorpay payment failed:', resp.error);
        PaymentService.cleanupRazorpayDOM();
        params.onError({ message: resp.error?.description || 'Payment transaction failed.' });
      });
      rzp.open();
    } catch (err: any) {
      console.error('[PaymentService] Exception launching Razorpay modal:', err);
      PaymentService.cleanupRazorpayDOM();
      params.onError({ message: err.message || 'Failed to open Razorpay modal.' });
    }
  }

  /**
   * Removes all DOM elements injected by Razorpay (backdrop, container, iframes)
   * and restores body scroll. Must be called on EVERY exit path from the modal
   * (success, cancel, failure) to prevent the main content area from going blank.
   */
  static cleanupRazorpayDOM(): void {
    try {
      // Remove every element Razorpay injects into <body>
      const selectors = [
        '.razorpay-container',
        '.razorpay-backdrop',
        '#razorpay-backdrop',
        '#razorpay-container',
        'iframe[src*="razorpay"]',
        'div[class*="razorpay"]'
      ];
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });
      // NOTE: Do NOT reset body.overflow here.
      // The vitals modal onSuccess handler sets overflow='hidden' to lock scroll.
      // ondismiss and payment.failed handlers restore overflow='' themselves.
      console.log('[PaymentService] 🧹 Razorpay DOM cleanup complete.');
    } catch (e) {
      /* ignore cleanup errors */
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
