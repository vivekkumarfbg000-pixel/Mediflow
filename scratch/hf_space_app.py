import os
import time
import smtplib
from email.message import EmailMessage
import pandas as pd
import gradio as gr
import requests as http_requests
from threading import Thread
from datetime import datetime

# Supabase Imports
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

# Environment configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL") or "https://kguupaybvbngyzyofjun.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk"
TEACH_TEAM_WEBHOOK = os.environ.get("TEACH_TEAM_WEBHOOK") or ""

# Gap 4: GitHub Repository Dispatch configuration
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or ""
GITHUB_REPO = os.environ.get("GITHUB_REPO") or ""  # e.g. "username/Mediflow-ecosystem"

# Gap 8: Admin email notification configuration
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or ""
SMTP_USER = os.environ.get("SMTP_USER") or ""
SMTP_PASS = os.environ.get("SMTP_PASS") or ""
SMTP_HOST = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
SMTP_PORT = int(os.environ.get("SMTP_PORT") or "465")

# Gap 3: Deduplication — track already-escalated incident IDs to prevent spam
escalated_ids = set()

# Global telemetry logs store for UI presentation
event_logs = []

def log_event(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {message}"
    event_logs.append(formatted)
    print(formatted)
    # Keep last 100 logs for deeper audit trail
    if len(event_logs) > 100:
        event_logs.pop(0)


# ─── Gap 8 Fix: Admin Email/SMS Notification ─────────────────────────────────────
def send_admin_alert(subject, body):
    """Send critical alert email to the admin when escalation triggers."""
    if not ADMIN_EMAIL or not SMTP_USER or not SMTP_PASS:
        log_event("⚠️ Admin email not configured (ADMIN_EMAIL/SMTP_USER/SMTP_PASS). Skipping email alert.")
        return False

    try:
        msg = EmailMessage()
        msg['Subject'] = f"[MEDIFLOW CRITICAL] {subject}"
        msg['From'] = SMTP_USER
        msg['To'] = ADMIN_EMAIL
        msg.set_content(body)

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        log_event(f"📧 Admin alert email sent to {ADMIN_EMAIL}")
        return True
    except Exception as e:
        log_event(f"❌ Failed to send admin email: {str(e)}")
        return False


# ─── Gap 4 Fix: GitHub Repository Dispatch API ──────────────────────────────────
def dispatch_github_teach_team(telemetry_id, subsystem, error_code, error_prompt):
    """Trigger the Teach Team workflow via GitHub's repository_dispatch API."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        log_event("⚠️ GITHUB_TOKEN or GITHUB_REPO not set. Cannot dispatch Teach Team workflow remotely.")
        return False

    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/dispatches"
        headers = {
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        payload = {
            "event_type": "teach-team-escalation",
            "client_payload": {
                "telemetry_id": str(telemetry_id),
                "subsystem": subsystem,
                "error_code": error_code,
                "error_prompt": error_prompt[:4000],  # GitHub limits payload size
                "timestamp": datetime.now().isoformat()
            }
        }

        res = http_requests.post(url, json=payload, headers=headers, timeout=15)

        if res.status_code == 204:
            log_event(f"🚀 GitHub Actions Teach Team workflow dispatched successfully for {telemetry_id}.")
            return True
        else:
            log_event(f"❌ GitHub dispatch failed: HTTP {res.status_code} — {res.text[:200]}")
            return False
    except Exception as e:
        log_event(f"❌ GitHub dispatch exception: {str(e)}")
        return False


def trigger_teach_team_escalation(telemetry_id, subsystem, error_code, error_stack, attempts, execution_history=""):
    """Full escalation pipeline: log → GitHub dispatch → admin email alert."""
    log_event(f"{'=' * 60}")
    log_event(f"🚨 ESCALATING INCIDENT {telemetry_id} TO TEACH TEAM PIPELINE 🚨")
    log_event(f"{'=' * 60}")

    error_prompt = f"""[CRITICAL SYSTEM OUTAGE — AUTONOMOUS ESCALATION]
Subsystem: {subsystem}
Error Code: {error_code}
Healing Attempts: {attempts}
Timestamp: {datetime.now().isoformat()}

Failed Self-Healing Attempts Summary:
{execution_history or "System Auto-Healer failed to resolve in 3+ consecutive attempts."}

Error Stack Trace:
{error_stack}

INSTRUCTION FOR TEACH TEAM:
Surgically inspect the code boundaries, locate the root cause in the '{subsystem}' layer,
write the architect_blueprint.md, run the CTO patch compiler, pass security audits, and push the fix.
"""

    log_event(f"Compiled escalation prompt ({len(error_prompt)} chars)")

    # Step 1: Dispatch to GitHub Actions (Gap 4 Fix)
    github_ok = dispatch_github_teach_team(telemetry_id, subsystem, error_code, error_prompt)

    # Step 2: Send admin email notification (Gap 8 Fix)
    email_subject = f"Subsystem={subsystem} | Error={error_code} | Attempts={attempts}"
    email_body = f"""Mediflow Autonomous Agent detected a critical unresolvable incident.

Telemetry ID: {telemetry_id}
Subsystem: {subsystem}
Error Code: {error_code}
Healing Attempts: {attempts}
GitHub Dispatch: {"✅ Sent" if github_ok else "❌ Failed/Not configured"}

Error Stack:
{error_stack[:2000]}

The Teach Team pipeline has been {"triggered" if github_ok else "NOT triggered (check GITHUB_TOKEN/GITHUB_REPO secrets)"}.

— Mediflow Autonomous Operations Agent
"""
    send_admin_alert(email_subject, email_body)

    # Step 3: Mark incident as escalated in database
    if supabase_client:
        try:
            supabase_client.table("system_health_telemetry") \
                .update({"status": "escalated", "updated_at": datetime.now().isoformat()}) \
                .eq("id", telemetry_id) \
                .execute()
            log_event(f"📝 Telemetry {telemetry_id} marked as 'escalated' in database.")
        except Exception as e:
            log_event(f"⚠️ Failed to update telemetry status: {str(e)}")


# Connect to Supabase
supabase_client = None
if create_client:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        log_event("Connected to Supabase Database successfully.")
    except Exception as e:
        log_event(f"Error connecting to Supabase: {str(e)}")


# Proactive background monitoring daemon
def monitor_daemon():
    log_event("Autonomous Monitor Daemon thread online 🧠")

    if not supabase_client:
        log_event("Running in simulation mode - no database connection available.")
        while True:
            time.sleep(10)
            log_event("Periodic health check: All simulated clinic nodes operational.")
        return

    # Check and trigger escalation logic
    while True:
        try:
            # Query recent incidents
            res = supabase_client.table("system_health_telemetry") \
                .select("id, subsystem, error_code, error_stack, status, healing_attempts") \
                .in_("status", ["healing", "failed"]) \
                .order("created_at", desc=True) \
                .limit(10) \
                .execute()

            if res.data:
                for row in res.data:
                    attempts = row.get("healing_attempts", 0)
                    status = row.get("status")
                    telemetry_id = row.get("id")

                    # Gap 3 Fix: Only escalate each incident ONCE
                    if telemetry_id in escalated_ids:
                        continue

                    if status == "failed" or attempts >= 3:
                        log_event(f"🚨 Escalation trigger: ID={telemetry_id} | Subsystem={row['subsystem']} | Attempts={attempts}")

                        # Fetch self-healing execution logs for context
                        history = ""
                        try:
                            logs_res = supabase_client.table("self_healing_execution_logs") \
                                .select("action_taken, outcome") \
                                .eq("telemetry_id", telemetry_id) \
                                .execute()
                            if logs_res.data:
                                history = "\n".join([
                                    f"[{i+1}] {log['action_taken']} -> {log['outcome']}"
                                    for i, log in enumerate(logs_res.data)
                                ])
                        except Exception:
                            pass

                        trigger_teach_team_escalation(
                            telemetry_id=telemetry_id,
                            subsystem=row["subsystem"],
                            error_code=row["error_code"],
                            error_stack=row.get("error_stack", "N/A"),
                            attempts=attempts,
                            execution_history=history
                        )

                        # Gap 3 Fix: Mark as escalated to prevent re-triggering
                        escalated_ids.add(telemetry_id)

            # Also log heartbeat every 60 cycles (10s * 60 = 10 min)
            time.sleep(10)
        except Exception as e:
            log_event(f"Error in monitor loop: {str(e)}")
            time.sleep(15)


# Start background monitoring thread
thread = Thread(target=monitor_daemon, daemon=True)
thread.start()

# UI Refresh Functions
def get_system_health():
    if not supabase_client:
        return pd.DataFrame([
            {"Service": "Supabase Database", "Status": "Healthy", "Latency": "120ms"},
            {"Service": "FastAPI Backend", "Status": "Healthy", "Latency": "85ms"},
            {"Service": "Meta Webhooks Queue", "Status": "Healthy", "Latency": "10ms"}
        ])
    try:
        res = supabase_client.table("system_health_telemetry") \
            .select("subsystem, status") \
            .order("created_at", desc=True) \
            .limit(10) \
            .execute()

        db_status = "Healthy"
        backend_status = "Healthy"
        whatsapp_status = "Healthy"

        if res.data:
            for row in res.data:
                if row["status"] in ("failed", "escalated"):
                    if row["subsystem"] == "database":
                        db_status = "Degraded"
                    elif row["subsystem"] == "backend":
                        backend_status = "Degraded"
                    elif row["subsystem"] == "whatsapp_api":
                        whatsapp_status = "Degraded"

        return pd.DataFrame([
            {"Service": "Supabase Database", "Status": db_status, "Latency": "Optimal"},
            {"Service": "FastAPI Backend", "Status": backend_status, "Latency": "Optimal"},
            {"Service": "Meta Webhooks Queue", "Status": whatsapp_status, "Latency": "Optimal"}
        ])
    except Exception as e:
        return pd.DataFrame([{"Error": str(e), "Status": "Error", "Latency": "N/A"}])

def get_telemetry_table():
    if not supabase_client:
        return pd.DataFrame([{"ID": "MOCK-1", "Subsystem": "frontend", "Error": "MockException", "Status": "healed"}])
    try:
        res = supabase_client.table("system_health_telemetry") \
            .select("id, subsystem, error_code, status, healing_attempts, created_at") \
            .order("created_at", desc=True) \
            .limit(15) \
            .execute()

        if res.data:
            return pd.DataFrame(res.data)
        return pd.DataFrame([{"Status": "No telemetry logs recorded yet."}])
    except Exception as e:
        return pd.DataFrame([{"Error": str(e)}])

def get_escalation_count():
    return f"**{len(escalated_ids)}** incidents escalated to Teach Team"

def get_agent_logs():
    return "\n".join(reversed(event_logs))

# Gradio Dashboard Design
with gr.Blocks(theme=gr.themes.Soft(), title="Mediflow SaaS Operations Center") as demo:
    gr.Markdown("# 🛡️ Mediflow SaaS Autonomous DevSecOps Space")
    gr.Markdown("Active proactive monitoring agent running live health telemetry audits.")

    with gr.Row():
        with gr.Column(scale=2):
            gr.Markdown("### 🩺 Service Health Heartbeat")
            health_tbl = gr.DataFrame(value=get_system_health, every=5)

            gr.Markdown("### 📋 Real-Time Incident Stream")
            telemetry_tbl = gr.DataFrame(value=get_telemetry_table, every=5)

        with gr.Column(scale=1):
            gr.Markdown("### 🧠 Proactive Agent Logs")
            logs_output = gr.Textbox(value=get_agent_logs, every=2, label="Live Console Output", max_lines=25, autoscroll=True)

            gr.Markdown("### 🚨 Escalation Stats")
            esc_count = gr.Markdown(value=get_escalation_count, every=5)

            btn_refresh = gr.Button("Force Re-Check Systems")
            btn_refresh.click(fn=get_system_health, outputs=health_tbl)

    gr.Markdown("---")
    gr.Markdown("Mediflow Operations Center • Managed Autonomously via Hugging Face Spaces & Teach Team Pipeline")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
