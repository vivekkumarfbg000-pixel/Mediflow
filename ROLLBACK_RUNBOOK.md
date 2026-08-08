# Mediflow Rollback Runbook
## Emergency Rollback Procedures

---

## 🚨 Quick Reference

| Scenario | Rollback Type | Estimated Time | Command |
|----------|---------------|----------------|---------|
| Bad frontend deploy | Vercel instant rollback | < 1 min | Vercel Dashboard → Deployments → "Rollback" |
| Bad backend deploy | Supabase migration down | 5-10 min | `supabase db reset --linked` + re-apply good migrations |
| Bad DB migration | SQL down migration | 2-5 min | Run down migration SQL |
| Critical bug in prod | Git revert + redeploy | 5-10 min | `git revert <commit> && git push` |
| Database corruption | PITR restore | 10-30 min | Supabase Dashboard → Backups → Restore |

---

## 🔴 Frontend Rollback (Vercel)

### Option 1: Instant Rollback (Recommended)
```bash
# Via Vercel Dashboard
1. Go to Vercel Dashboard → Project → Deployments
2. Find previous working deployment
2. Click "..." → "Rollback"
3. Confirm
```

### Option 2: Git Revert + Redeploy
```bash
# 1. Find bad commit
git log --oneline -10

# 2. Revert
git revert <bad-commit-hash>
git push origin main

# 3. Vercel auto-deploys from main
```

### Option 3: Vercel CLI
```bash
vercel rollback <deployment-url> --token=$VERCEL_TOKEN
```

---

## 🔵 Backend Rollback (Supabase)

### Option 1: Migration Down (If migration has down script)
```bash
# Check migration status
supabase migration list --linked

# Rollback last migration
supabase migration down --linked

# Or specific migration
supabase migration down 20260810000005 --linked
```

### Option 2: Manual SQL Down Migration
```bash
# Run down migration SQL manually in Supabase SQL Editor
-- Example: Drop table created by migration
DROP TABLE IF EXISTS public.new_table;

-- Example: Drop column
ALTER TABLE public.existing_table DROP COLUMN IF EXISTS new_column;

-- Example: Drop function
DROP FUNCTION IF EXISTS public.new_function();

-- Example: Drop policy
DROP POLICY IF EXISTS "policy_name" ON public.table_name;
```

### Option 3: Full DB Reset (Last Resort)
```bash
# ⚠️ DESTRUCTIVE - Only use if absolutely necessary
supabase db reset --linked

# Then re-apply all migrations
supabase db push --linked
```

---

## 🟣 Database Rollback (PITR - Point in Time Recovery)

### Via Supabase Dashboard
1. Go to Supabase Dashboard → Database → Backups
2. Click "Restore" on desired backup
3. Select "Point in time recovery"
4. Choose timestamp (up to 7 days ago)
5. Select "Create new project" or "Overwrite existing"
6. Wait for completion (10-30 min)

### Via API (Automated)
```bash
# Create recovery branch
curl -X POST "https://api.supabase.com/v1/projects/<project-ref>/branches" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "recovery-'$(date +%s)'",
    "git_branch": "main",
    "region": "ap-south-1",
    "recovery_time": "2026-08-09T10:00:00Z"
  }'
```

### Verify PITR
```bash
# Check restored data
curl -X GET "https://<project>.supabase.co/rest/v1/unified_invoices?select=count" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

---

## 🟢 Git Rollback Procedures

### Revert Single Commit
```bash
git revert <commit-hash>
git push origin main
```

### Revert Merge Commit
```bash
git revert -m 1 <merge-commit-hash>
git push origin main
```

### Revert Multiple Commits
```bash
# Revert last 3 commits
git revert HEAD~3..HEAD
git push origin main
```

### Hard Reset (Last Resort - Team Coordination Required)
```bash
# ⚠️ DESTRUCTIVE - Coordinate with team first!
git reset --hard <good-commit-hash>
git push --force-with-lease origin main

# Team members must then:
git fetch origin
git reset --hard origin/main
```

---

## 🟡 Edge Function Rollback

### Via Supabase Dashboard
1. Go to Edge Functions
2. Click function name
3. Click "Deployments" tab
4. Click "Rollback" on previous version

### Via CLI
```bash
# List deployments
supabase functions list

# Deploy previous version (if you have the code)
supabase functions deploy <function-name> --project-ref <ref>
```

---

## 📋 Rollback Verification Checklist

After any rollback, verify:

- [ ] Frontend loads without errors
- [ ] Authentication works (login/logout)
- [ ] Payment flow works (test + cash)
- [ ] Webhook endpoints responding
- [ ] Real-time sync working
- [ ] Database queries returning data
- [ ] Edge functions healthy (`/functions/v1/health`)
- [ ] No console errors in browser
- [ ] Sentry not reporting new errors

---

## 📞 Escalation Contacts

| Issue | Primary | Secondary | Time to Respond |
|-------|---------|-----------|-----------------|
| Frontend down | Lead Engineer | DevOps | 5 min |
| Backend/API down | Backend Lead | Lead Engineer | 5 min |
| Payment failing | Payment Engineer | Lead Engineer | 10 min |
| DB corruption | DBA | Backend Lead | 15 min |
| Security breach | Security Lead | CTO | Immediate |

---

## 📝 Post-Rollback Actions

1. **Document incident** in incident tracker
2. **Root cause analysis** within 24 hours
3. **Fix root cause** in new branch
4. **Test fix** in staging
4. **Deploy fix** with extra monitoring
5. **Update runbook** with lessons learned

---

## 🧪 Rollback Testing Schedule

| Frequency | Test | Owner |
|-----------|------|-------|
| Weekly | Frontend Vercel rollback | DevOps |
| Bi-weekly | Backend migration down | Backend Lead |
| Monthly | PITR restore test | DBA |
| Quarterly | Full DR drill | All |

---

**Last Updated**: 2026-08-09  
**Next Review**: 2026-09-09