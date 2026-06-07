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
| Login button hangs on spinner (stuck) | [Section 2A — Login Spinner Stuck](#2a--login-spinner-stuck--hanging-redirect-double-load-race) |
| Partner sign-in/sign-up errors or blocked | [Section 2B — Partner Sign-In/Up](#2b--partner-sign-in-and-sign-up-issues) |
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

### 2A — Login Spinner Stuck / Hanging Redirect (Double-Load Race)

**Symptom:** You enter your email and password, click "Enter Workspace", the button displays a spinner (`Loader2`), but it hangs indefinitely and never redirects to the dashboard. No console errors are displayed.

**Why it happens:**
This is caused by a double-load race condition in the React state. The `signInWithPassword` API triggers the global `onAuthStateChange` listener in `App.tsx` immediately upon success, which kicks off profile fetching/healing. If the login form handler also manually calls `onAuthSuccess(session, profile)` in parallel, both flows attempt to set the `session` and `activeProfile` states in `App.tsx` concurrently. This causes a deadlock/race that freezes the UI loading state.

**How to fix:**
1. Do **NOT** invoke the `onAuthSuccess` callback from the submit handler of your login forms.
2. Rely entirely on `onAuthStateChange` to handle session updates and dashboard redirects.
3. Replace the form submission handlers in the UI with non-blocking equivalents (e.g. use `handleEmailSignIn` instead of `handleRealEmailSignIn` inside `AuthGateway.tsx`).

---

### 2B — Partner Sign-In and Sign-Up Issues

**Symptom:** Pharmacist or Lab Technician partners cannot log in (credentials are correct, but they get stuck or receive "Not registered as partner" errors), or the "Partner Sign In" tab is not responsive or not intuitive.

**Why it happens:**
1. **Wrong tab/labels:** The main authentication tab was historically labeled "Partner Join", which led existing partners to believe they could only register, not sign in.
2. **Incorrect form submit handlers:** The partner sign-in form was using `handleRealPartnerSignIn` (which called `signInWithRealProfile` and deadlocked on the spinner due to `onAuthSuccess` race conditions).
3. **Missing Partner signup fields:** When partners register, the clinic code (e.g. `MF-A1B2`) must be validated against the `pods` table. If the database schema or RPC functions are out of sync, registration will fail.

**How to fix:**
1. Ensure the tab button in the header is labeled **"Partner Sign In"** rather than "Partner Join".
2. Ensure the partner login form uses the `handlePartnerSignIn` submit handler (which authenticates without manually triggering the `onAuthSuccess` callback).
3. If registration fails:
   - Check if the `join_clinic_network` RPC exists in Postgres.
   - Verify that the entered Clinic Code matches the `clinic_code` in the `pods` table:
     ```sql
     SELECT id, name FROM public.pods WHERE clinic_code = 'MF-A1B2';
     ```
   - Make sure that the pending partner is approved by the doctor in the settings tab (Ecosystem Partners), which moves their entity status from `'pending'` to `'approved'` and triggers an instant dashboard loading transition via Realtime.

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

## 6. Level 2: Advanced Diagnostics — When the App is STILL Not Loading

If you have executed the basic diagnostics, restarted the dev server, verified that `diagnose.js` reports all green, and the website **still** does not load (e.g., stuck on a blank screen, silent crash on certain user actions, or showing chunk loading failures), use this advanced diagnostic playbook.

### 6A — Silent ReferenceErrors at Runtime
* **Symptom:** The initial page renders, but clicking a tab or logging in causes a sudden blank screen. The browser console outputs a red error: `ReferenceError: <variable> is not defined`.
* **Why it happens:** This occurs when an import statement was removed during code cleanup (such as when resolving circular dependencies), but the compiler didn't flag it because the variable is referenced deep inside a class body or runtime callback that only executes after user interaction.
* **How to diagnose:**
  1. Open the browser DevTools Console and click the line number in the stack trace (e.g. `api.ts:467`).
  2. Perform a codebase-wide grep for that variable name.
* **How to fix:**
  - Restore the import, or rewrite the logic so the module is loaded dynamically (e.g., using `const { module } = await import(...)` inside the method) to keep circular dependency chains broken.
  - Run `npx tsc --noEmit` before staging or pushing changes to let the TypeScript compiler perform static code analysis and flag missing references.

### 6B — Dynamic Chunk Load Failure
* **Symptom:** The console reports: `Failed to fetch dynamically imported module: http://localhost:5173/src/components/...`.
* **Why it happens:** Vite's hot module replacement (HMR) or build bundler cache contains outdated references to code chunks that were renamed, deleted, or updated in another git branch.
* **How to diagnose:** Check the DevTools **Network** tab. If dynamic modules show up as red `404 Not Found`, the browser is trying to load stale chunk files.
* **How to fix:**
  1. Terminate the dev server.
  2. Clear Vite's cache directory:
     ```powershell
     Remove-Item -Recurse -Force "node_modules/.vite" -ErrorAction SilentlyContinue
     ```
  3. Perform a browser **hard refresh** (`Ctrl + Shift + R` or `Cmd + Shift + R`) to force clean JS cache reload.

### 6C — Poisoned Local Storage Cache
* **Symptom:** The dashboard loads and works perfectly in an Incognito/Private window, but displays a persistent blank screen or spinner in the user's regular browser.
* **Why it happens:** The app caches clinical state (such as WhatsApp sessions, patient lists, or active pod settings) in the browser's `localStorage` to speed up page load. If database schemas or structures change, loading stale local JSON objects can throw uncaught exceptions during initialization.
* **How to diagnose:** Run this command in the DevTools console:
  ```javascript
  localStorage.clear();
  location.reload();
  ```
  If the page loads successfully after this, the local cache was corrupted.
* **How to prevent:** Ensure code parsing local storage variables wraps `JSON.parse` inside safe `try-catch` blocks and falls back to default empty structures if corrupted.

### 6D — Infinite Hook / Sync Loops
* **Symptom:** The browser tab becomes completely frozen, CPU usage spikes to 100%, and the console repeatedly prints: `Maximum update depth exceeded. This can happen when a component repeatedly calls setState...`.
* **Why it happens:** An effect hook updates state, which triggers a re-render, triggering the effect again. In Mediflow, this can happen if the real-time telemetry agent triggers a sync upon finding a minor error, and the sync callback encounters another error, creating a high-speed retry loop.
* **How to diagnose:** Look at the call stack output in the console warning to identify which component is looping.
* **How to fix:**
  1. Inspect the dependency arrays on `useEffect` blocks. Ensure variables updated *inside* the effect are not included in the dependency array without conditional guards.
  2. Implement debouncing or guard clauses to enforce minimum intervals between database sync actions.

---

## 7. Emergency Recovery Checklist

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

## 8. Mediflow-Specific Known Issues & Solutions

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
| Clinic roles see "Platform Operations" | `allowedRolesMap` in `Navbar.tsx` maps `'saas_admin'` to `'doctor'` role | Remove `'saas_admin'` from `'doctor'`'s allowed list in `Navbar.tsx` and `App.tsx` |
| SaaS Platform Owner sees clinic modules | `'admin'` / `'platform_admin'` allowed lists include clinic modules | Set allowed lists for `'admin'` and `'platform_admin'` to only `['saas_admin']` |
| SaaS Platform Owner dashboard doesn't load | Owner profile's role in database was set to `'patient'` instead of `'platform_admin'` | Update database profiles table: run `UPDATE public.profiles SET role = 'platform_admin' WHERE id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';` |

> ⚠️ **Circular import rule of thumb**: When breaking a circular dependency, check ALL usages of the removed import across the entire file. A simple `grep` for the variable name will show you if it's used in 1 place or 50 places.

---

## 9. Useful DevTools Commands

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

## 10. Who to Contact

| Situation | Action |
|-----------|--------|
| RLS / Database issue | Run the diagnostic SQL queries above → share output with Dr. Vivek |
| Code/import error | Check git blame: `git log --follow -p src/services/api.ts` |
| Vercel deployment broken | Check Vercel build logs → ensure env vars are set |
| Supabase down | Check https://status.supabase.com |

---

> **Skill maintained by**: Mediflow Engineering Team
> **Last updated**: June 2026 (updated with Level 2 Advanced Diagnostics, sidebar role isolation, and SaaS owner login fix)
> **Real incidents this skill resolved**: Circular import crash (api.ts ↔ autoHealerAgent.ts), supabaseCircuit ReferenceError after partial import removal, RLS blocking WhatsApp sessions, WABA connection auth failures, clinic/owner sidebar role leakage, owner login role mismatch

