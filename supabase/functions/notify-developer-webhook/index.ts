import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// =============================================================================
// Mediflow — notify-developer-webhook Edge Function
//
// Triggered by the Postgres trigger `trg_critical_telemetry_webhook` whenever a
// CRITICAL row is inserted into `system_health_telemetry`.
//
// Env Vars required in Supabase Vault:
//   DISCORD_WEBHOOK_URL  — Discord channel incoming webhook URL
//   SLACK_WEBHOOK_URL    — Slack incoming webhook URL (optional)
//   TELEGRAM_BOT_TOKEN   — Telegram bot token (optional)
//   TELEGRAM_CHAT_ID     — Telegram chat/group ID (optional)
// =============================================================================

interface TelemetryPayload {
  event: string;
  id: string;
  pod_id: string;
  subsystem: string;
  severity: string;
  error_code: string | null;
  error_stack: string | null;
  healing_attempts: number;
  status: string;
  created_at: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: TelemetryPayload = await req.json();
    console.log(
      "[Notify Developer] Received critical telemetry:",
      JSON.stringify(payload)
    );

    const {
      id,
      pod_id,
      subsystem,
      error_code,
      error_stack,
      healing_attempts,
      status,
      created_at,
    } = payload;

    // Resolve notification targets from Supabase Vault secrets
    const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!discordWebhookUrl && !slackWebhookUrl && (!telegramBotToken || !telegramChatId)) {
      console.warn("[Notify Developer] No notification channels configured.");
      return new Response(
        JSON.stringify({ status: "no_channels_configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Emoji mapping per subsystem
    const subsystemLabel: Record<string, string> = {
      frontend:     "💻 Frontend",
      backend:      "⚡ Backend",
      database:     "🗄️ Database",
      whatsapp_api: "💬 WhatsApp API",
      agentic_ai:   "🧠 Agentic AI",
    };
    const label = subsystemLabel[subsystem.toLowerCase()] ?? "🔧 " + subsystem;
    const timestamp = new Date(created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const cleanStack = error_stack
      ? error_stack.substring(0, 800) + (error_stack.length > 800 ? "\n… (truncated)" : "")
      : "No stack trace captured.";

    const dispatches: Promise<void>[] = [];

    // ── Discord ─────────────────────────────────────────────────────────────
    if (discordWebhookUrl) {
      const discordBody = {
        username: "VitalSync Sentinel 🛡️",
        embeds: [
          {
            title: `🚨 CRITICAL ANOMALY — ${label}`,
            color: 0xe74c3c, // Red
            fields: [
              { name: "🆔 Telemetry ID",      value: `\`${id}\``,                       inline: true  },
              { name: "🏥 Pod / Tenant",       value: `\`${pod_id}\` `,                  inline: true  },
              { name: "❗ Error Code",         value: `\`${error_code ?? "N/A"}\``,     inline: true  },
              { name: "♻️ Healing Attempts",  value: `${healing_attempts}`,              inline: true  },
              { name: "📊 Status",             value: `\`${status.toUpperCase()}\``,     inline: true  },
              { name: "🕐 Detected (IST)",     value: timestamp,                         inline: true  },
              { name: "📋 Stack Trace",        value: `\`\`\`js\n${cleanStack}\n\`\`\`` },
            ],
            footer: { text: "VitalSync Autonomous Recovery System" },
          },
        ],
      };
      dispatches.push(
        fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordBody),
        }).then(async (res) => {
          if (!res.ok) console.error("[Discord] Error:", await res.text());
          else console.log("[Discord] Alert sent ✅");
        })
      );
    }

    // ── Slack ────────────────────────────────────────────────────────────────
    if (slackWebhookUrl) {
      const slackBody = {
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `🚨 Critical in ${label}`, emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*ID:*\n\`${id}\`` },
              { type: "mrkdwn", text: `*Pod:*\n\`${pod_id}\`` },
              { type: "mrkdwn", text: `*Error Code:*\n\`${error_code ?? "N/A"}\`` },
              { type: "mrkdwn", text: `*Status:*\n\`${status.toUpperCase()}\`` },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Stack Trace:*\n\`\`\`${cleanStack}\`\`\`` },
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Healing Attempts: *${healing_attempts}*  |  Detected: *${timestamp} IST*` }],
          },
        ],
      };
      dispatches.push(
        fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackBody),
        }).then(async (res) => {
          if (!res.ok) console.error("[Slack] Error:", await res.text());
          else console.log("[Slack] Alert sent ✅");
        })
      );
    }

    // ── Telegram ─────────────────────────────────────────────────────────────
    if (telegramBotToken && telegramChatId) {
      // Telegram MarkdownV2 — special chars must be escaped
      const escape = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
      const msg = [
        `🚨 *CRITICAL ANOMALY* 🚨`,
        ``,
        `*Subsystem:* ${escape(label)}`,
        `*Error Code:* \`${escape(error_code ?? "N/A")}\``,
        `*Status:* \`${escape(status.toUpperCase())}\``,
        `*Pod ID:* \`${escape(pod_id)}\``,
        `*Detected:* ${escape(timestamp)} IST`,
        ``,
        `*Stack Trace:*`,
        `\`\`\``,
        escape(cleanStack),
        `\`\`\``,
      ].join("\n");

      dispatches.push(
        fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: "MarkdownV2" }),
        }).then(async (res) => {
          if (!res.ok) console.error("[Telegram] Error:", await res.text());
          else console.log("[Telegram] Alert sent ✅");
        })
      );
    }

    await Promise.all(dispatches);

    return new Response(
      JSON.stringify({ status: "success", channels_notified: dispatches.length }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e: any) {
    console.error("[Notify Developer] Exception:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
