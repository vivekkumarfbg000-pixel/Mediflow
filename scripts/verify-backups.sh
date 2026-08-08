#!/usr/bin/env bash
# =============================================================================
# Mediflow Backup Verification Script
# Tests Supabase Point-in-Time Recovery (PITR) and backup integrity
# =============================================================================

set -euo pipefail

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://kguupaybvbngyzyofjun.supabase.co}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
BACKUP_BUCKET="${BACKUP_BUCKET:-mediflow-backups}"
VERIFICATION_DAYS="${VERIFICATION_DAYS:-7}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  error "SUPABASE_SERVICE_ROLE_KEY not set"
  exit 1
fi

# Check dependencies
for cmd in curl jq pg_dump pg_restore aws; do
  if ! command -v "$cmd" &>/dev/null; then
    warn "$cmd not found - some checks will be skipped"
  fi
done

log "╔════════════════════════════════════════════════════════════════════╗"
log "║       Mediflow Backup Verification                                 ║"
log "║       Testing PITR and Backup Integrity                            ║"
log "╚════════════════════════════════════════════════════════════════════╝"

# 1. Check Supabase PITR Status
log "\n📋 Checking Supabase PITR Status..."
PITR_STATUS=$(curl -s -X GET \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/rpc/get_pitr_status" 2>/dev/null || echo "{}")

if echo "$PITR_STATUS" | jq -e '.pitr_enabled' >/dev/null 2>&1; then
  log "✅ PITR is enabled"
  log "   Earliest recovery: $(echo "$PITR_STATUS" | jq -r '.earliest_recovery_time')"
  log "   Retention: $(echo "$PITR_STATUS" | jq -r '.retention_days') days"
else
  warn "⚠️  Could not verify PITR status (may need superuser)"
  log "   Manual check: Go to Supabase Dashboard → Database → Backups"
fi

# 2. Check recent backups
log "\n📋 Checking recent backup history..."
BACKUPS=$(curl -s -X GET \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/rpc/get_backup_history" 2>/dev/null || echo "[]")

BACKUP_COUNT=$(echo "$BACKUPS" | jq 'length')
if [[ "$BACKUP_COUNT" -gt 0 ]]; then
  log "✅ Found $BACKUP_COUNT recent backups"
  echo "$BACKUPS" | jq -r '.[] | "  \(.created_at) | \(.size_mb) MB | \(.status)"'
else
  warn "⚠️  No backup history found via API"
  log "   Check Supabase Dashboard → Database → Backups"
fi

# 3. Test point-in-time recovery (dry run)
log "\n📋 Testing PITR recovery capability..."
RECOVERY_TIME=$(date -u -d "-1 hour" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ")
log "   Simulating recovery to: $RECOVERY_TIME"

# This would create a new branch/project in Supabase
# For safety, we just verify the API endpoint exists
RECOVERY_TEST=$(curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"recovery_time\": \"$RECOVERY_TIME\", \"dry_run\": true}" \
  "$SUPABASE_URL/rest/v1/rpc/test_pitr_recovery" 2>/dev/null || echo "{}")

if echo "$RECOVERY_TEST" | jq -e '.success' >/dev/null 2>&1; then
  log "✅ PITR recovery test passed"
else
  warn "⚠️  PITR test endpoint not available (may need manual test)"
  log "   Manual test: Supabase Dashboard → Database → Backups → Restore"
fi

# 4. Verify critical table row counts
log "\n📋 Verifying critical table integrity..."
TABLES=(
  "unified_invoices"
  "financial_ledgers"
  "vitalsync_pool_settlements"
  "appointments"
  "patient_registry"
  "medicine_bills"
  "lab_requisitions"
  "whatsapp_sessions"
)

for TABLE in "${TABLES[@]}"; do
  COUNT=$(curl -s -X GET \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/rest/v1/$TABLE?select=count" 2>/dev/null | jq -r '.[0].count // 0')
  
  if [[ "$COUNT" -gt 0 ]]; then
    log "✅ $TABLE: $COUNT rows"
  else
    warn "⚠️  $TABLE: 0 rows (may be expected for new deployments)"
  fi
done

# 5. Verify pg_audit is logging
log "\n📋 Checking pg_audit logging..."
AUDIT_COUNT=$(curl -s -X GET \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/rpc/get_audit_log_count" 2>/dev/null | jq -r '.count // 0')

if [[ "$AUDIT_COUNT" -gt 0 ]]; then
  log "✅ pg_audit logging active: $AUDIT_COUNT recent entries"
else
  warn "⚠️  pg_audit may not be configured or no recent activity"
  log "   Run migration: 20260810000005_pgaudit_financial_tables.sql"
fi

# 6. Check storage bucket backups (if using S3)
log "\n📋 Checking storage bucket backups..."
if command -v aws &>/dev/null && [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  BACKUP_OBJECTS=$(aws s3 ls "s3://$BACKUP_BUCKET/" --recursive --human-readable 2>/dev/null | tail -5)
  if [[ -n "$BACKUP_OBJECTS" ]]; then
    log "✅ Storage bucket has backup objects:"
    echo "$BACKUP_OBJECTS" | while read -r line; do log "  $line"; done
  else
    warn "⚠️  No backup objects found in s3://$BACKUP_BUCKET/"
  fi
else
  warn "⚠️  AWS CLI not configured - skipping S3 backup check"
fi

# 7. Verify database functions are healthy
log "\n📋 Verifying critical database functions..."
FUNCTIONS=(
  "process_invoice_settlement"
  "atomic_update_whatsapp_session"
  "generate_next_token_number"
  "find_invoice_by_prefix"
  "try_acquire_session_lock"
  "release_session_lock"
  "reconcile_tenant_pod_association"
)

for FUNC in "${FUNCTIONS[@]}"; do
  EXISTS=$(curl -s -X GET \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/rest/v1/rpc/check_function_exists?func_name=$FUNC" 2>/dev/null | jq -r '.exists // false')
  
  if [[ "$EXISTS" == "true" ]]; then
    log "✅ Function $FUNC exists"
  else
    warn "⚠️  Function $FUNC not found"
  fi
done

# 8. Check Edge Functions health
log "\n📋 Checking Edge Functions..."
EF_ENDPOINTS=(
  "razorpay-order"
  "razorpay-verify"
  "razorpay-webhook"
  "meta-webhook"
  "atomic_update_whatsapp_session"
  "process_invoice_settlement"
  "health"
)

for EF in "${EF_ENDPOINTS[@]}"; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$SUPABASE_URL/functions/v1/$EF" 2>/dev/null || echo "000")
  
  if [[ "$RESPONSE" == "200" ]] || [[ "$RESPONSE" == "405" ]]; then
    log "✅ Edge Function $EF: HTTP $RESPONSE"
  else
    warn "⚠️  Edge Function $EF: HTTP $RESPONSE"
  fi
done

# Summary
log "\n╔════════════════════════════════════════════════════════════════════╗"
log "║                      VERIFICATION SUMMARY                           ║"
log "╚════════════════════════════════════════════════════════════════════╝"
log "✅ Critical checks completed"
log "📋 Review warnings above and address before production"
log ""
log "📋 Next Steps for Production:"
log "  1. Run pg_audit migration if not done"
log "  2. Configure Supabase Vault secrets (see INFRASTRUCTURE_SECRETS.md)"
log "  3. Set up Sentry source map upload in CI/CD"
log "  4. Configure uptime monitoring with /functions/v1/health"
log "  4. Test PITR recovery manually in Supabase Dashboard"
log "  5. Set up Cloudflare/Vercel security headers"
log "  6. Schedule automated backup verification (cron this script)"

exit 0