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

    // Authenticate caller: require valid Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate request body
    const bodyJson = await req.json().catch(() => ({}));
    const validationResult = z.object({
      prompt: z.string().min(1).max(32_000, "Prompt too long").optional(),
      model: z.enum(["mistral-large-latest", "llama-3.3-70b-versatile", "gemini-2.5-flash"]).optional(),
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
      model = "mistral-large-latest",
      maxTokens = 2048,
      temperature = 0.15,
      contents,
      generationConfig
    } = validationResult.data;

    // ── Gemini Proxy Mode (BUG-05 Security Hardening) ────────────────────────
    if (model === "gemini-2.5-flash") {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        console.error("[ai-inference] GEMINI_API_KEY not set in Vault.");
        return new Response(JSON.stringify({ error: "Gemini API key is not configured in Vault." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(errBody)}`);
        }

        const result = await response.json();
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("[ai-inference] Gemini proxy call failed:", err);
        return new Response(JSON.stringify({ error: err.message || "Gemini API call failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // ── Groq Fallback ─────────────────────────────────────────────────────────
    if (!content) {
      const groqKey = Deno.env.get("GROQ_API_KEY");
      if (!groqKey) {
        console.error("[ai-inference] GROQ_API_KEY not set in Vault. No fallback available.");
        return new Response(JSON.stringify({ error: "AI inference unavailable: API keys not configured." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          temperature: temperature + 0.05, // Groq works slightly better at +0.05
          max_tokens: maxTokens,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        content = data.choices?.[0]?.message?.content ?? "";
        modelUsed = groqModel;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[ai-inference] Groq fallback also failed:", errData);
        return new Response(JSON.stringify({ error: "AI inference failed on all providers." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "AI returned an empty response." }), {
        status: 502,
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
