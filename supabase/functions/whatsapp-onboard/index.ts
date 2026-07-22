import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — whatsapp-onboard Edge Function
// Handles doctor clinic WhatsApp number registration under the OWNER's WABA.
// Doctors never need a Meta account — all billing is on the platform owner.
//
// Required Supabase Vault Secrets (set by owner ONCE):
//   OWNER_WABA_ID          — Owner's WhatsApp Business Account ID from Meta
//   OWNER_SYSTEM_TOKEN     — Owner's permanent system user token from Meta
//   WABA_DECRYPTION_KEY    — Symmetric key for encrypting tokens in DB
//
// Actions (via POST body `action` field):
//   "request_otp"  — Register phone under owner WABA + send OTP to clinic phone
//   "verify_otp"   — Verify OTP with Meta + save real credentials to DB
// =============================================================================

const META_GRAPH_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Rate Limiter Check (5 onboarding requests/min per client IP)
  if (await isRateLimited(req, supabase, 5, 60)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Load owner credentials from Supabase Vault ─────────────────────────────
  const ownerWabaId     = Deno.env.get("OWNER_WABA_ID") || Deno.env.get("META_WABA_ID");
  const ownerToken      = Deno.env.get("OWNER_SYSTEM_TOKEN") || Deno.env.get("META_ACCESS_TOKEN");
  const wabaDecryptKey  = Deno.env.get("WABA_DECRYPTION_KEY");

  if (!ownerWabaId || !ownerToken || !wabaDecryptKey) {
    console.error("[whatsapp-onboard] FATAL: Missing required vault secrets.");
    return new Response(
      JSON.stringify({
        error: "Server configuration error. Contact Mediflow support.",
        code: "MISSING_VAULT_SECRETS"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    // =========================================================================
    // ACTION 1: request_otp
    // Registers the clinic phone number under the owner's WABA and requests OTP
    // =========================================================================
    if (action === "request_otp") {
      const { clinicPhone, clinicName, podId, otpMethod = "SMS" } = body;

      if (!clinicPhone || !clinicName || !podId) {
        return new Response(
          JSON.stringify({ error: "clinicPhone, clinicName, and podId are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize phone number — strip non-digits, ensure country code
      const rawDigits = clinicPhone.replace(/\D/g, "");
      // Support +91XXXXXXXXXX or 91XXXXXXXXXX or just 10-digit
      const normalizedPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
      const countryCode = normalizedPhone.substring(0, 2); // e.g. "91"
      const localNumber  = normalizedPhone.substring(2);    // remaining digits

      console.log(`[whatsapp-onboard] Registering clinic: "${clinicName}" | Phone: +[REDACTED] | Pod: ${podId}`);

      // ── Step 1: Add phone number to owner's WABA ───────────────────────────
      const registerRes = await fetch(`${META_BASE_URL}/${ownerWabaId}/phone_numbers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cc: countryCode,
          phone_number: localNumber,
          verified_name: clinicName,
          migrate_whatsapp_number: false // Set true if number was on personal WhatsApp
        })
      });

      const registerData = await registerRes.json();
      console.log("[whatsapp-onboard] Meta register response:", JSON.stringify(registerData));

      if (!registerRes.ok || registerData.error) {
        const metaErr = registerData.error?.message ?? "Unknown Meta API error";
        console.error("[whatsapp-onboard] Phone registration failed:", metaErr);

        // Handle common errors gracefully
        if (metaErr.includes("already registered")) {
          return new Response(
            JSON.stringify({
              error: "This number is already registered on WhatsApp Business API. If it belongs to your clinic, contact Mediflow support to migrate it.",
              code: "ALREADY_REGISTERED"
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: `Meta API Error: ${metaErr}`, code: "META_REGISTER_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phoneNumberId: string = registerData.id;

      // ── Step 2: Request OTP code to clinic phone ───────────────────────────
      const otpRes = await fetch(`${META_BASE_URL}/${phoneNumberId}/request_code`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code_method: otpMethod === "VOICE" ? "VOICE" : "SMS",
          language: "en_US"
        })
      });

      const otpData = await otpRes.json();
      console.log("[whatsapp-onboard] OTP request response:", JSON.stringify(otpData));

      if (!otpRes.ok || otpData.error) {
        const otpErr = otpData.error?.message ?? "Unknown OTP error";
        console.error("[whatsapp-onboard] OTP request failed:", otpErr);
        return new Response(
          JSON.stringify({ error: `OTP dispatch failed: ${otpErr}`, code: "OTP_REQUEST_FAILED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[whatsapp-onboard] OTP sent successfully to +[REDACTED] via ${otpMethod}`);

      return new Response(
        JSON.stringify({
          success: true,
          phoneNumberId,
          message: `Verification code sent to +[REDACTED] via ${otpMethod}. Enter the 6-digit code to activate.`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ACTION 2: verify_otp
    // Verifies the OTP with Meta, then saves real WABA credentials to database
    // =========================================================================
    if (action === "verify_otp") {
      const { phoneNumberId, otpCode, clinicPhone, clinicName, podId, entityId } = body;

      if (!phoneNumberId || !otpCode || !clinicPhone || !clinicName || !podId) {
        return new Response(
          JSON.stringify({ error: "phoneNumberId, otpCode, clinicPhone, clinicName, podId are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Step 1: Verify OTP with Meta ───────────────────────────────────────
      const verifyRes = await fetch(`${META_BASE_URL}/${phoneNumberId}/verify_code`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code: otpCode.trim() })
      });

      const verifyData = await verifyRes.json();
      console.log("[whatsapp-onboard] OTP verify response:", JSON.stringify(verifyData));

      if (!verifyRes.ok || verifyData.error) {
        const verErr = verifyData.error?.message ?? "OTP verification failed";
        console.error("[whatsapp-onboard] OTP mismatch:", verErr);
        return new Response(
          JSON.stringify({
            error: "Incorrect verification code. Please check your SMS and try again.",
            code: "OTP_MISMATCH"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[whatsapp-onboard] OTP verified ✅ for Phone ID: ${phoneNumberId}`);

      // ── Step 2: Set clinic display name on the phone number (optional) ─────
      // This name shows in the WhatsApp Business profile
      try {
        await fetch(`${META_BASE_URL}/${phoneNumberId}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ownerToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ verified_name: clinicName })
        });
      } catch (nameErr) {
        // Non-fatal — name update failure doesn't block activation
        console.warn("[whatsapp-onboard] Display name update failed (non-fatal):", nameErr);
      }

      // ── Step 3: Encrypt the owner's token for this clinic record ──────────
      // Each clinic gets an encrypted copy of the owner's system token
      const { data: encryptedToken, error: cryptErr } = await supabase.rpc("encrypt_waba_token", {
        token: ownerToken,
        secret_key: wabaDecryptKey
      });

      if (cryptErr || !encryptedToken) {
        console.error("[whatsapp-onboard] Token encryption failed:", cryptErr?.message);
        return new Response(
          JSON.stringify({ error: "Secure token storage failed. Contact support.", code: "CRYPTO_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Step 4: Normalize phone number for storage ─────────────────────────
      const rawDigits = clinicPhone.replace(/\D/g, "");
      const normalizedPhone = rawDigits.length === 10 ? `+91${rawDigits}` : `+${rawDigits}`;

      // ── Step 5: Upsert waba_connection record for this clinic pod ──────────
      const connectionRecord = {
        pod_id: podId,
        entity_id: entityId ?? podId, // fallback to podId if entity not provided
        phone_number_id: phoneNumberId,
        waba_id: ownerWabaId,
        phone_number: normalizedPhone,
        clinic_display_name: clinicName,
        encrypted_system_user_token: encryptedToken,
        waba_status: "active",
        verified_at: new Date().toISOString()
      };

      const { data: savedConnection, error: dbErr } = await supabase
        .from("waba_connections")
        .upsert(connectionRecord, { onConflict: "pod_id" })
        .select()
        .single();

      if (dbErr) {
        console.error("[whatsapp-onboard] DB insert failed:", dbErr.message);
        return new Response(
          JSON.stringify({ error: `Database save failed: ${dbErr.message}`, code: "DB_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[whatsapp-onboard] ✅ Clinic "${clinicName}" activated! Pod: ${podId} | PhoneId: ${phoneNumberId}`);

      return new Response(
        JSON.stringify({
          success: true,
          connection: {
            id: savedConnection.id,
            phone_number: normalizedPhone,
            phone_number_id: phoneNumberId,
            waba_id: ownerWabaId,
            clinic_display_name: clinicName,
            waba_status: "active",
            verified_at: savedConnection.verified_at
          },
          message: `WhatsApp chatbot for "${clinicName}" is now LIVE! Patients will see "${clinicName}" when they receive messages.`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: `Unknown action: "${action}". Use "request_otp" or "verify_otp".` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[whatsapp-onboard] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error.", detail: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
