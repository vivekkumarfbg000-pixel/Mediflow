---
name: Resolve Website Not Loading
description: Step-by-step diagnostic and fix playbook for when the Mediflow frontend fails to load — covers blank screens, React crashes, circular imports, Supabase auth issues, and dev server problems.
---

# 🚨 Skill: Resolve Website Not Loading

This skill teaches the Mediflow team how to **systematically diagnose and fix** any situation where the website (frontend dashboard) shows a blank screen, white page, or fails to render. Based on real production incidents resolved on this project.

---

## 🔍 Quick Symptom Lookup

| Symptom | Jump To |
|---------|---------|
| Blank white screen, no content | [Section 1 — React Crash](#1-blank-white-screen--react-crash) |
| Login page shows but dashboard doesn't load | [Section 2 — Auth / Profile Issue](#2-login-shows-but-dashboard-blank) |
| App loads but WhatsApp/feature not working | [Section 3 — Feature Not Responding](#3-specific-feature-not-working) |
| Dev server won't start | [Section 4 — Dev Server Failure](#4-dev-server-wont-start) |
| App works locally but not on Vercel | [Section 5 — Deployment Issues](#5-vercel-deployment-issues) |

---

## 1. Blank White Screen / React Crash

### Step 1 — Open Browser DevTools Console

Press `F12` → go to **Console** tab. Look for red error messages.

**Critical errors to identify:**

```
❌ Cannot read properties of null (reading 'useState')
   → CAUSE: Circular import chain broke React module initialization
   → FIX: See Section 1A below

❌ Invalid hook call. Hooks can only be called inside a function component.
   → CAUSE: Circular import or duplicate React instances
   → FIX: See Section 1A below

❌ Uncaught SyntaxError: ...
   → CAUSE: TypeScript/JS compilation error
   → FIX: Check terminal/dev server output for exact line

❌ Failed to fetch dynamically imported module: ...
   → CAUSE: A lazy import() failed (network or 404)
   → FIX: Check the file exists and the path is correct
```

---

### 1A — Circular Import Fix (Most Common Root Cause)

**What is a circular import?**
When File A imports from File B, and File B imports from File A. This can cause modules to be `null`/`undefined` at startup, crashing React.

**Mediflow's known circular chain (now fixed):**
```
api.ts  ──imports──►  autoHealerAgent.ts
autoHealerAgent.ts  ──imports──►  api.ts   ← 🔄 CIRCULAR!

api.ts  ──imports──►  telemetry.ts
telemetry.ts  ──imports──►  autoHealerAgent.ts
autoHealerAgent.ts  ──imports──►  api.ts   ← 🔄 CIRCULAR!
```

**How to detect circular imports:**

```powershell
# In the frontend directory, run:
cd "c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend"

# Check for duplicate React instances (should show only ONE react@x.x.x)
npm ls react --depth=2

# Find all files that import from api.ts
Get-ChildItem -Recurse -Filter "*.ts","*.tsx" | Select-String "from.*./api"
```

**How to fix a circular import:**

Option A — Remove the dead import (if it's never used):
```typescript
// BEFORE (in autoHealerAgent.ts):
import { api } from './api';   // ← delete this if api is never used

// AFTER: just remove the line
```

Option B — Use dynamic lazy import (if you DO need to call the other module):
```typescript
// BEFORE:
import { api } from './api';
// ...somewhere in the code:
await api.syncFromSupabase();

// AFTER (breaks the circular chain):
// Dynamic import loads the module lazily at call time, not at startup
const { api: apiModule } = await import('./api');
await apiModule.syncFromSupabase();
```

**After fixing, always hard refresh the browser:**
```
Ctrl + Shift + R  (Windows)
Cmd + Shift + R   (Mac)
```

---

### 1B — Check for Build/Compilation Errors

Look at the **terminal where `npm run dev` is running**.

```powershell
# Start the dev server if not running:
cd "c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend"
npm run dev

# Common error messages in terminal:
# ✅ "Local: http://localhost:5173/" = server running fine
# ❌ "error: ... is not exported from ..." = bad import
# ❌ "SyntaxError at line X" = code syntax error
# ❌ "Cannot find module ..." = missing npm package or wrong path
```

**If you see TypeScript errors:**
```powershell
# Check all TypeScript errors without building:
npx tsc --noEmit
```

---

### 1C — Clear Vite Cache

Sometimes Vite's cache gets corrupted.

```powershell
cd "c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend"

# Stop the dev server first (Ctrl+C), then:
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue

# Restart:
npm run dev
```

---

## 2. Login Shows But Dashboard Blank

The login/auth screen loads fine, but after logging in, nothing renders.

### Step 1 — Check Supabase Auth in Console

```javascript
// Paste in browser DevTools console:
(async () => {
  const { data } = await supabase.auth.getSession();
  console.log('Session:', data.session);
  console.log('User:', data.session?.user);
  console.log('Role:', data.session?.user?.user_metadata?.role);
})();
```

### Step 2 — Check Profile Table

The app reads the `profiles` table after login to get the user's role.

```sql
-- Run in Supabase SQL Editor:
SELECT id, role, display_name, entity_id, status
FROM public.profiles
WHERE id = auth.uid();
```

**If the profile row is missing** → The user registered but the profile trigger didn't fire. Run:
```sql
-- Create the missing profile manually:
INSERT INTO public.profiles (id, role, display_name)
VALUES (
  '<user-id-from-auth>',
  'doctor',          -- or compounder, lab_technician, pharmacist
  'Dr. Your Name'
);
```

### Step 3 — Check RLS Policies

If RLS is too strict, the app can't read any data after login.

```sql
-- Test if current user can read their own profile:
SELECT * FROM public.profiles WHERE id = auth.uid();

-- If this returns empty for a logged-in user, RLS is blocking them.
-- Check policies:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
```

### Step 4 — Check Console for RLS Errors

```
❌ "permission denied for table profiles"
   → RLS blocking the logged-in user from reading their own profile
   → Add self-access policy (see migration: 20260605000003_harden_profiles_self_access_rls.sql)

❌ "JWT expired"
   → User's session token expired. They need to log out and log back in.
   → The auto-healer session renewal should handle this. If not, manually run:
      supabase.auth.refreshSession()
```

---

## 3. Specific Feature Not Working

### WhatsApp Chatbot Not Responding

**Symptoms:** Simulator opens but messages don't appear / bot doesn't reply.

**Diagnosis checklist:**

```javascript
// 1. Check WhatsApp sessions exist in localStorage
JSON.parse(localStorage.getItem('mediflow_whatsapp_sessions') || '[]')

// 2. Check patient data is loaded
JSON.parse(localStorage.getItem('mediflow_patients') || '[]').length

// 3. Force re-sync from Supabase
await window.api.syncFromSupabase();
```

**Common fixes:**

| Issue | Fix |
|-------|-----|
| Sessions empty | Click any patient → session auto-initializes |
| Bot not replying | Check browser console for errors in `processIncomingWhatsAppMessage` |
| State stuck in wrong state | Run `localStorage.removeItem('mediflow_whatsapp_sessions')` → refresh |
| Supabase DB write failing | Check RLS on `whatsapp_sessions` table (see `20260605000004_fix_waba_connections_rls.sql`) |

**Check Supabase for session state:**
```sql
-- View all active WhatsApp sessions:
SELECT patient_phone, current_state, last_interaction,
       session_data->>'consentGranted' AS consent
FROM public.whatsapp_sessions
ORDER BY last_interaction DESC
LIMIT 20;
```

---

### Realtime/Sync Not Working

**Symptom:** Data changes made by one role aren't visible in another role's dashboard.

```javascript
// Check realtime channel status in console:
// Look for: "[Mediflow Realtime] Channel status changed: SUBSCRIBED"
// If it says CLOSED or CHANNEL_ERROR, the realtime connection is broken.

// Force reconnect:
window.location.reload();
```

**Check Supabase Realtime:**
```sql
-- In Supabase dashboard → Realtime → Check "Broadcast" is enabled for your tables
-- Ensure RLS allows SELECT for authenticated users on tables you want realtime on
```

---

## 4. Dev Server Won't Start

```powershell
cd "c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend"

# Error: "port 5173 already in use"
# Kill the process using the port:
netstat -ano | findstr :5173
# Note the PID from output, then:
taskkill /PID <pid> /F
npm run dev

# Error: "node_modules not found" or "cannot find module X"
npm install
npm run dev

# Error: "vite: command not found"
npx vite
# OR reinstall:
npm install --save-dev vite
npm run dev

# Nuclear option — full reset:
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

---

## 5. Vercel Deployment Issues

**App works locally but not on Vercel.**

### Check Environment Variables

The most common cause: Supabase env vars not set in Vercel.

Go to: Vercel Dashboard → Project → Settings → Environment Variables

Required variables for Mediflow:
```
VITE_SUPABASE_URL      = https://kguupaybvbngyzyofjun.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIs...
```

> ⚠️ Note: Mediflow has a fallback hardcoded in `supabaseClient.ts` so the app
> doesn't crash even without env vars. But production deployments should always
> set these explicitly.

### Check CORS / Vercel Routing

If pages like `/dashboard` return 404 on refresh, you need the Vite SPA routing config.

Check `vercel.json` in the project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Check Vercel Build Logs

Vercel Dashboard → Deployments → Click a deployment → View build output.

```
❌ "Build failed: exit code 1"  → TypeScript or build error
❌ "Module not found: ..."       → Missing dependency or wrong import path
✅ "Build Completed in X"        → Build is fine, check env vars or CORS
```

---

## 6. Emergency Recovery Checklist

Run this checklist in order when nothing else works:

```powershell
# STEP 1: Kill and restart dev server
# (Ctrl+C to stop, then:)
cd "c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend"
npm run dev

# STEP 2: Clear Vite cache
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
npm run dev

# STEP 3: Clear browser state
# (In browser DevTools → Application → Storage → Clear site data)

# STEP 4: Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install
npm run dev

# STEP 5: Check git for recent changes that might have broken things
git log --oneline -10
git diff HEAD~1 HEAD -- src/
```

---

## 7. Mediflow-Specific Known Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| Blank screen on first load | Circular import between `api.ts` ↔ `autoHealerAgent.ts` | Use dynamic `import()` in autoHealerAgent for api calls |
| `useState is null` error | Circular imports causing React module to be null | Remove dead imports; use lazy imports |
| `supabaseCircuit is not defined` (repeating error) | The circuit breaker import was deleted but the variable is still used in many places inside `api.ts` | Restore `import { supabaseCircuit, backendApiCircuit } from './autoHealerAgent'` — safe now because autoHealerAgent uses dynamic import for api |
| Cannot login with email/password | User doesn't exist in `auth.users` | Run SQL: `SELECT * FROM auth.users WHERE email = 'x@y.com'` |
| Dashboard loads but no data | RLS blocking the logged-in user | Check `profiles.entity_id` is set; check RLS policies |
| WhatsApp tab shows 0 sessions | No sessions in localStorage + RLS blocking Supabase sync | Clear localStorage, reload, let auto-init run |
| WABA connection shows disconnected | `waba_connections` RLS too strict | Apply migration `20260605000004_fix_waba_connections_rls.sql` |
| HMR (hot reload) crashes | Multiple Supabase realtime channel subscriptions | Use `supabase.removeChannel()` before re-subscribing |

> ⚠️ **Circular import rule of thumb**: When breaking a circular dependency, check ALL usages of the removed import across the entire file. A simple `grep` for the variable name will show you if it's used in 1 place or 50 places.

---

## 8. Useful DevTools Commands

Paste these directly in the browser's DevTools console while on the app:

```javascript
// ── Check auth status ──────────────────────────────────────────
const { data } = await supabase.auth.getSession();
console.log('User:', data.session?.user?.email, '| Role:', data.session?.user?.user_metadata);

// ── Check what's in local storage ─────────────────────────────
Object.keys(localStorage)
  .filter(k => k.startsWith('mediflow_'))
  .map(k => ({ key: k, count: JSON.parse(localStorage[k] || '[]')?.length ?? '?' }));

// ── Force re-sync data from Supabase ──────────────────────────
await window.api.syncFromSupabase();

// ── Reset WhatsApp sessions (fixes stuck chatbot) ─────────────
localStorage.removeItem('mediflow_whatsapp_sessions');
location.reload();

// ── Check realtime connection ─────────────────────────────────
supabase.getChannels().map(c => ({ name: c.topic, state: c.state }));
```

---

## 9. Who to Contact

| Situation | Action |
|-----------|--------|
| RLS / Database issue | Run the diagnostic SQL queries above → share output with Dr. Vivek |
| Code/import error | Check git blame: `git log --follow -p src/services/api.ts` |
| Vercel deployment broken | Check Vercel build logs → ensure env vars are set |
| Supabase down | Check https://status.supabase.com |

---

> **Skill maintained by**: Mediflow Engineering Team
> **Last updated**: June 2026 (updated with supabaseCircuit ReferenceError incident)
> **Real incidents this skill resolved**: Circular import crash (api.ts ↔ autoHealerAgent.ts), supabaseCircuit ReferenceError after partial import removal, RLS blocking WhatsApp sessions, WABA connection auth failures

