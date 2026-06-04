#!/usr/bin/env python3
"""
Mediflow Autonomous Proactive Agent v2.0.0
Designed to run on Hugging Face Spaces.
Monitors system_health_telemetry and triggers Teach Team escalation when self-healing fails.

v2.0.0 Fixes:
  - Gap 1: Works with the new healing_attempts counter that properly increments
  - Gap 3: Deduplication — each incident is escalated only once
  - Gap 4: Triggers Teach Team via GitHub Repository Dispatch API
  - Gap 8: Sends admin email notification on critical escalation
"""
import os
import sys
import time
import json
import smtplib
from email.message import EmailMessage
from datetime import datetime

try:
    import requests as http_requests
except ImportError:
    http_requests = None

# Try importing supabase client
try:
    from supabase import create_client, Client
except ImportError:
    print("[HF Agent] Warning: 'supabase' module not installed. Running in simulation mode.")
    Client = None

# Configure environment
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "https://kguupaybvbngyzyofjun.supabase.co"
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk"

# Gap 4: GitHub configuration
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or ""
GITHUB_REPO = os.environ.get("GITHUB_REPO") or ""

# Gap 8: Email notification configuration
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or ""
SMTP_USER = os.environ.get("SMTP_USER") or ""
SMTP_PASS = os.environ.get("SMTP_PASS") or ""
SMTP_HOST = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
SMTP_PORT = int(os.environ.get("SMTP_PORT") or "465")

# Gap 3: Deduplication — track already-escalated incident IDs
escalated_ids = set()


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


# ─── Gap 8 Fix: Admin Email Alert ────────────────────────────────────────────────
def send_admin_alert(subject, body):
    if not ADMIN_EMAIL or not SMTP_USER or not SMTP_PASS:
        log("⚠️ Admin email not configured. Skipping email alert.")
        return

    try:
        msg = EmailMessage()
        msg['Subject'] = f"[MEDIFLOW CRITICAL] {subject}"
        msg['From'] = SMTP_USER
        msg['To'] = ADMIN_EMAIL
        msg.set_content(body)

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        log(f"📧 Admin alert email sent to {ADMIN_EMAIL}")
    except Exception as e:
        log(f"❌ Failed to send admin email: {str(e)}")


# ─── Gap 4 Fix: GitHub Repository Dispatch ───────────────────────────────────────
def dispatch_github_teach_team(telemetry_id, subsystem, error_code, error_prompt):
    if not GITHUB_TOKEN or not GITHUB_REPO:
        log("⚠️ GITHUB_TOKEN or GITHUB_REPO not set. Cannot dispatch Teach Team remotely.")
        return False

    if not http_requests:
        log("⚠️ 'requests' library not installed. Cannot dispatch GitHub API call.")
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
                "error_prompt": error_prompt[:4000],
                "timestamp": datetime.now().isoformat()
            }
        }

        res = http_requests.post(url, json=payload, headers=headers, timeout=15)

        if res.status_code == 204:
            log(f"🚀 GitHub Actions Teach Team workflow dispatched for {telemetry_id}.")
            return True
        else:
            log(f"❌ GitHub dispatch failed: HTTP {res.status_code} — {res.text[:200]}")
            return False
    except Exception as e:
        log(f"❌ GitHub dispatch exception: {str(e)}")
        return False


def trigger_teach_team_escalation(telemetry_id, subsystem, error_code, error_stack, attempts, execution_history=""):
    log(f"{'=' * 60}")
    log(f"🚨 ESCALATING INCIDENT {telemetry_id} TO TEACH TEAM PIPELINE 🚨")
    log(f"{'=' * 60}")

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

    # Step 1: Dispatch to GitHub Actions
    github_ok = dispatch_github_teach_team(telemetry_id, subsystem, error_code, error_prompt)

    # Step 2: Send admin email notification
    email_subject = f"Subsystem={subsystem} | Error={error_code} | Attempts={attempts}"
    email_body = f"""Mediflow Autonomous Agent detected a critical unresolvable incident.

Telemetry ID: {telemetry_id}
Subsystem: {subsystem}
Error Code: {error_code}
Healing Attempts: {attempts}
GitHub Dispatch: {"✅ Sent" if github_ok else "❌ Failed/Not configured"}

Error Stack:
{error_stack[:2000]}

— Mediflow Autonomous Operations Agent (HF Monitor Daemon)
"""
    send_admin_alert(email_subject, email_body)


def check_incident_status(supabase_client, telemetry_id):
    if not supabase_client:
        return
    try:
        response = supabase_client.table("system_health_telemetry") \
            .select("id, subsystem, error_code, error_stack, status, healing_attempts") \
            .eq("id", telemetry_id) \
            .execute()

        if response.data:
            record = response.data[0]
            attempts = record.get("healing_attempts", 0)
            status = record.get("status")
            log(f"Auditing Telemetry ID={telemetry_id} | Status={status} | Attempts={attempts}")

            # Fetch corresponding self-healing logs
            logs_res = supabase_client.table("self_healing_execution_logs") \
                .select("action_taken, outcome") \
                .eq("telemetry_id", telemetry_id) \
                .execute()

            history = ""
            if logs_res.data:
                history = "\n".join([f"[{i+1}] {lg['action_taken']} -> {lg['outcome']}" for i, lg in enumerate(logs_res.data)])

            if status == "failed" or attempts >= 3:
                trigger_teach_team_escalation(
                    telemetry_id=record["id"],
                    subsystem=record["subsystem"],
                    error_code=record["error_code"],
                    error_stack=record.get("error_stack", "N/A"),
                    attempts=attempts,
                    execution_history=history
                )

                # Mark as escalated in database
                try:
                    supabase_client.table("system_health_telemetry") \
                        .update({"status": "escalated", "updated_at": datetime.now().isoformat()}) \
                        .eq("id", telemetry_id) \
                        .execute()
                except Exception:
                    pass
    except Exception as e:
        log(f"Error querying database: {str(e)}")


def start_polling_loop(supabase_client):
    log("Background poll loop active. Querying Supabase every 10 seconds...")
    try:
        while True:
            res = supabase_client.table("system_health_telemetry") \
                .select("id, status, healing_attempts") \
                .in_("status", ["healing", "failed"]) \
                .order("created_at", desc=True) \
                .limit(10) \
                .execute()

            if res.data:
                for row in res.data:
                    # Gap 3 Fix: Skip already-escalated incidents
                    if row["id"] in escalated_ids:
                        continue

                    attempts = row.get("healing_attempts", 0)
                    if row["status"] == "failed" or attempts >= 3:
                        check_incident_status(supabase_client, row["id"])
                        escalated_ids.add(row["id"])

            time.sleep(10)
    except KeyboardInterrupt:
        log("Monitor stopped by keyboard interrupt.")


def start_realtime_listener(supabase_client):
    log("Launching Supabase Realtime Listener...")
    try:
        channel = supabase_client.channel("realtime_hf_monitor")

        def on_telemetry_update(payload):
            record = payload.get("new", {})
            status = record.get("status")
            attempts = record.get("healing_attempts", 0)
            tid = record.get("id")

            log(f"Realtime telemetry event: Status={status} | Attempts={attempts}")

            # Gap 3 Fix: Skip already-escalated
            if tid and tid in escalated_ids:
                return

            if status == "failed" or attempts >= 3:
                check_incident_status(supabase_client, tid)
                if tid:
                    escalated_ids.add(tid)

        channel.on(
            "postgres_changes",
            {"event": "UPDATE", "schema": "public", "table": "system_health_telemetry"},
            on_telemetry_update
        ).subscribe()

        log("Subscribed successfully. Listening to system health telemetry channel.")
        while True:
            time.sleep(1)
    except Exception as e:
        log(f"Realtime subscription failed: {str(e)}. Falling back to polling loop.")
        start_polling_loop(supabase_client)


def run_local_simulation():
    log("No Supabase credentials or library found. Simulating telemetry loop...")
    telemetry_id = "sim-1234"
    log(f"Simulating anomaly: Subsystem=database | Error=ColumnDriftException")

    history = (
        "[1] Scan live schema -> Missing vitals column. Triggering repair RPC -> RPC Timeout\n"
        "[2] Retrying repair RPC -> Connection interrupted\n"
        "[3] Flush database connections and execute repair -> Failed: permission denied"
    )

    time.sleep(2)
    trigger_teach_team_escalation(
        telemetry_id=telemetry_id,
        subsystem="database",
        error_code="ColumnDriftException",
        error_stack='column "vitals" schema drift detected in patient_registry relation at public.execute_autonomous_db_repair line 15',
        attempts=3,
        execution_history=history
    )


def main():
    log("=" * 60)
    log(f"🟢 Mediflow Autonomous Monitoring Agent v2.0.0 — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 🟢")
    log("=" * 60)

    if Client is not None:
        try:
            log(f"Initializing client connection to URL: {SUPABASE_URL}")
            client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

            # Start monitoring with Realtime, fallback to poll loop on subscription failure
            start_realtime_listener(client)
        except Exception as e:
            log(f"Connection setup failed: {str(e)}. Running simulation.")
            run_local_simulation()
    else:
        run_local_simulation()


if __name__ == "__main__":
    main()
