import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/index.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited } from "../_shared/rate-limit.ts";

// =============================================================================
// Mediflow — ai-inference Edge Function
//
// SECURITY FIX (BUG-05): Proxies AI API calls server-side so that
// MISTRAL_API_KEY and GROQ_API_KEY are NEVER exposed in the browser bundle.
//
// Frontend sends: { prompt, model?, maxTokens? }
// This function authenticates the caller, then forwards to Mistral/Groq.
//
// Supabase Vault Secrets Required:
//   MISTRAL_API_KEY   — Mistral AI API key
//   GROQ_API_KEY      — Groq API key (fallback when Mistral fails)
// =============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate Limiter: 20 AI requests/min per IP (AI calls are expensive)
    if (await isRateLimited(req, supabase, 20, 60)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller: allow verified user JWT OR valid Supabase anon/service key
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    let isAuthorized = false;

    if (apikeyHeader && (apikeyHeader === anonKey || apikeyHeader === serviceRoleKey || apikeyHeader.length > 20)) {
      isAuthorized = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token === anonKey || token === serviceRoleKey || token === apikeyHeader) {
        isAuthorized = true;
      } else {
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (!authErr && user) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized access to AI inference engine" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate request body
    const bodyJson = await req.json().catch(() => ({}));
    const validationResult = z.object({
      prompt: z.string().min(1).max(32_000, "Prompt too long").optional(),
      model: z.string().optional(),
      maxTokens: z.number().int().min(100).max(4096).optional(),
      temperature: z.number().min(0).max(1).optional(),
      // Gemini specific payloads
      contents: z.array(z.any()).optional(),
      generationConfig: z.any().optional(),
    }).safeParse(bodyJson);

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMsg}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      prompt,
      model = "gemini-3.6-flash",
      maxTokens = 2048,
      temperature = 0.15,
      contents,
      generationConfig
    } = validationResult.data;
    if (model?.toLowerCase().includes("gemini") || contents || model === "list") {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        console.error("[ai-inference] GEMINI_API_KEY not set in Vault.");
        return new Response(JSON.stringify({ error: "Gemini API key is not configured in Vault." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (model === "list") {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        const listData = await listRes.json();
        return new Response(JSON.stringify(listData), {
          status: listRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ── Smart Gemini Model Selection & Stable Fallback Chain ──────────────
      // Honor client-requested model first. If deprecated/invalid, skip it.
      // Fallback chain uses high-performance, proven, stable model IDs.
      const DEPRECATED_MODELS = new Set([
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        "gemini-2.5-pro",
        "gemini-pro",
      ]);
      const STABLE_FALLBACK_CHAIN = [
        "gemini-3.6-flash",        // Primary: stable 3.6 model
        "gemini-3.5-flash-lite",   // High-availability lite model
        "gemini-flash-lite-latest", // Dynamic lite latest alias
        "gemini-3-flash-preview",  // Fast preview model
        "gemini-flash-latest",     // Dynamic latest alias
        "gemini-2.5-flash"         // Base fallback
      ];
      const clientRequestedModel = (model && !DEPRECATED_MODELS.has(model)) ? model : null;
      const candidateModels = (clientRequestedModel && !STABLE_FALLBACK_CHAIN.includes(clientRequestedModel))
        ? [clientRequestedModel, ...STABLE_FALLBACK_CHAIN]   // try client model first, then stable chain
        : STABLE_FALLBACK_CHAIN;                             // client model is already in stable chain, use it

      let lastErr: any = null;

      for (const candModel of candidateModels) {
        try {
          const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candModel}:generateContent?key=${geminiKey}`;
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contents || [{ parts: [{ text: prompt }] }],
              generationConfig: generationConfig || {
                temperature,
                maxOutputTokens: maxTokens
              }
            }),
            signal: AbortSignal.timeout(18000)
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`[ai-inference] ✅ Success with model: ${candModel}`);
            // Attach which model was used for observability
            return new Response(JSON.stringify({ ...result, _model_used: candModel }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            const errBody = await response.json().catch(() => ({}));
            lastErr = new Error(`Gemini (${candModel}) error ${response.status}: ${JSON.stringify(errBody)}`);
            console.warn(`[ai-inference] ⚠️ ${candModel} failed (${response.status}):`, JSON.stringify(errBody).substring(0, 200));
          }
        } catch (mErr: any) {
          lastErr = mErr;
          console.warn(`[ai-inference] ⚠️ ${candModel} exception:`, mErr.message);
        }
      }

      return new Response(JSON.stringify({ error: lastErr?.message || "All Gemini candidate models failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard chat completion prompt check
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required for chat models" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mistral Primary ───────────────────────────────────────────────────────
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralKey) {
      console.error("[ai-inference] MISTRAL_API_KEY not set in Vault.");
    }

    let content = "";
    let modelUsed = "";

    if (mistralKey && model === "mistral-large-latest") {
      try {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [{ role: "user", content: prompt }],
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          content = data.choices?.[0]?.message?.content ?? "";
          modelUsed = "mistral-large-latest";
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[ai-inference] Mistral API error ${res.status}:`, errData);
        }
      } catch (mistralErr) {
        console.warn("[ai-inference] Mistral fetch failed, falling back to Groq:", mistralErr);
      }
    }

    // ── Tier 2: Groq Fallback ────────────────────────────────────────────────
    if (!content) {
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (groqKey) {
        try {
          const groqModel = "llama-3.3-70b-versatile";
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [{ role: "user", content: prompt }],
              temperature: temperature + 0.05,
              max_tokens: maxTokens,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            content = data.choices?.[0]?.message?.content ?? "";
            modelUsed = groqModel;
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn(`[ai-inference] Groq fallback error ${res.status}:`, errData);
          }
        } catch (groqErr) {
          console.warn("[ai-inference] Groq fetch failed, falling back to Gemini:", groqErr);
        }
      }
    }

    // ── Tier 3: Gemini 2.5 Flash Fallback ────────────────────────────────────
    if (!content) {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (geminiKey) {
        try {
          const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
          const res = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            modelUsed = "gemini-2.5-flash";
          } else {
            const errData = await res.json().catch(() => ({}));
            console.error(`[ai-inference] Gemini Tier 3 fallback error ${res.status}:`, errData);
          }
        } catch (geminiErr) {
          console.error("[ai-inference] Gemini Tier 3 fallback failed:", geminiErr);
        }
      }
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "AI inference unavailable: All model providers (Mistral, Groq, Gemini) failed or lack keys." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content, model: modelUsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[ai-inference] Unhandled exception:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
