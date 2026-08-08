# Mediflow Production Go-Live Checklist
## Final Verification Before Production Deployment

---

## ✅ Phases 1-7 Complete Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Razorpay Production Configuration & Security Hardening | ✅ Complete |
| 2 | Auth & Session Security Fixes (Rules 63, 66, 69, 70, 74, 75, 76) | ✅ Complete |
| 3 | Database RLS & Multi-Tenant Isolation (Rules 72, 76, 77) | ✅ Complete |
| 4 | CDC/Realtime Architecture Validation (Rules 1, 77) | ✅ Complete |
| 5 | Payment Flow E2E Testing & Webhook Verification | ✅ Complete |
| 6 | Infrastructure & Monitoring Setup | ✅ Complete |
| 7 | Code Quality & Bundle Optimization | ✅ Complete |

---

## 🔴 Phase 8: Disaster Recovery & Go-Live Checklist

### 8.1 Infrastructure Verification

- [ ] **Supabase Vault Secrets Configured**
  - [ ] `RAZORPAY_KEY_ID` (live: `rzp_live_...`)
  - [ ] `RAZORPAY_KEY_SECRET` 
  - [ ] `RAZORPAY_WEBHOOK_SECRET`
  - [ ] `META_WHATSAPP_TOKEN`
  - [ ] `META_PHONE_NUMBER_ID`
  - [ ] `META_WABA_ID`
  - [ ] `META_APP_SECRET`
  - [ ] `META_VERIFY_TOKEN`
  - [ ] `SENTRY_DSN`
  - [ ] `SENTRY_AUTH_TOKEN`

- [ ] **DNS & SSL**
  - [ ] `app.vitalsync.in` → Vercel (valid TLS)
  - [ ] `api.vitalsync.in` → Supabase (valid TLS)
  - [ ] `admin.vitalsync.in` → Vercel (valid TLS)
  - [ ] HSTS preload submitted

- [ ] **Webhook URLs Registered**
  - [ ] Razorpay Dashboard: `https://<project>.supabase.co/functions/v1/razorpay-webhook`
  - [ ] Meta Dashboard: `https://<project>.supabase.co/functions/v1/meta-webhook`
  - [ ] Webhook secrets match Vault

### 8.2 Database & Migrations

- [ ] **All migrations applied to production Supabase**
  - [ ] 20260810000001_comprehensive_rls_pod_isolation.sql
  - [ ] 20260810000002_process_invoice_settlement_pod_id.sql
  - [ ] 20260810000003_whatsapp_broadcast_atomicity.sql
  - [ ] 20260810000004_encounter_trigger_pod_id.sql
  - [ ] 20260810000005_pgaudit_financial_tables.sql

- [ ] **pg_audit enabled** on financial tables
- [ ] **PITR enabled** with 7-day retention
- [ ] **RLS policies verified** on all 13 CDC tables

### 8.3 Payment Gateway Verification

- [ ] **Razorpay Live Keys** in Vault
- [ ] **Webhook HMAC verification** working
- [ ] **Idempotency keys** preventing duplicate processing
- [ ] **Cash counter flow** tested (`process_invoice_settlement` RPC)
- [ ] **Refund flow** documented for manual verification
- [ ] **Concurrency protection** tested (3 parallel webhooks → 1 succeeds)

### 8.4 Monitoring & Alerting

- [ ] **Health endpoint** responding: `/functions/v1/health`
- [ ] **Sentry DSN** configured, source maps uploading in CI/CD
- [ ] **Uptime monitoring** configured (health check every 60s)
- [ ] **Alert rules** configured:
  - [ ] Payment failure rate > 1%
  - [ ] CDC lag > 5s
  - [ ] Auth error rate > 0.1%
  - [ ] Edge function 5xx rate > 0.5%

### 8.5 Security & Compliance

- [ ] **No secrets in frontend bundle** (verified `grep -r "rzp_live_" dist/`)
- [ ] **CSP headers** strict, allowing only Razorpay, Meta, Supabase, Sentry
- [ ] **HSTS** enabled with preload
- [ ] **COOP/COEP** headers set
- [ ] **Permissions-Policy** restricting camera, microphone, geolocation
- [ ] **PCI-DSS SAQ-A** (Razorpay handles card data)
- [ ] **npm audit** clean (no high/critical vulnerabilities)
- [ ] **No hardcoded secrets** in codebase

### 8.6 Disaster Recovery

- [ ] **Backup verification script** runs daily (`scripts/verify-backups.sh`)
- [ ] **PITR tested** manually in Supabase Dashboard
- [ ] **Rollback plan documented**:
  - [ ] `git revert` for code
  - [ ] Supabase migration down scripts for DB
  - [ ] Vercel instant rollback
- [ ] **RTO/RPO defined**:
  - [ ] RTO: < 15 minutes
  - [ ] RPO: < 1 hour (PITR)

### 8.7 Load Testing

- [ ] **100 concurrent payments** simulated
- [ ] **500 CDC events/sec** handled
- [ ] **Webhook burst** (50/sec) handled
- [ ] **CDC latency** < 300ms under load

### 8.8 Documentation & Runbooks

- [ ] **INFRASTRUCTURE_SECRETS.md** complete
- [ ] **GO-LIVE_CHECKLIST.md** this file
- [ ] **Rollback runbook** with exact commands
- [ ] **Incident response** contacts documented
- [ ] **Team on-call** rotation configured

---

## 🟢 Go-Live Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Lead Engineer | | | |
| Security Review | | | |
| DevOps | | | |
| Product Owner | | | |

---

## 📋 Post-Launch (Day 1-7)

- [ ] Monitor payment success rate > 99%
- [ ] Monitor CDC sync lag < 300ms
- [ ] Monitor error rate < 0.1%
- [ ] Verify Sentry alerts firing correctly
- [ ] Verify uptime monitoring alerts
- [ ] Daily backup verification runs
- [ ] Sentry source maps uploading automatically

---

## 🚨 Emergency Contacts

| Service | Contact | Escalation |
|---------|---------|------------|
| Supabase | Support ticket + Discord | P0: 15 min |
| Razorpay | support@razorpay.com | P0: 30 min |
| Meta Business | Business Help Center | P0: 1 hr |
| Vercel | Support ticket | P1: 1 hr |
| Sentry | Support ticket | P1: 4 hr |

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-09  
**Next Review**: Post-launch Day 7