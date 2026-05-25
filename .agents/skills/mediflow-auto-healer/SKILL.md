---
name: Mediflow Auto-Healer
description: Autonomous Self-Healing and Operations Telemetry System for 24/7 Clinical Dashboard readiness.
---

# Mediflow Auto-Healer Agentic Skill

This skill equips Mediflow with the capability to autonomously monitor, diagnose, isolate, and repair frontend crashes, Deno Edge function timeouts, API limit exhausts, and database schema deviations in real-time. By structuring this system as a modular agentic skill, clinic instances and future developers can immediately execute self-healing protocols to guarantee **100% production-ready uptime**.

---

## 🔍 1. Subsystem Diagnostic & Healing Matrix

The Auto-Healer intercepts exceptions and maps them to specialized healing handlers:

```
[System Anomaly Detected]
         │
         ├──► [Type: Database Schema Drift] ──────► [Action: Execute Auto-Repair SQL RPC]
         │
         ├──► [Type: Frontend State Exception] ──► [Action: Flush Caches & Re-Sync State]
         │
         └──► [Type: API Rate Limit (HTTP 429)] ──► [Action: Hot Rollover to Backup Gateway]
```

### 🗄️ A. Database Schema Healing
* **Anomaly**: Missing indices, constraints, or table columns during operations.
* **Auto-Healer Action**: Executes a definer-level database repair RPC that automatically reconciles schema deviations using `ALTER` queries.

### 🖥️ B. Frontend State Healing
* **Anomaly**: Corrupted local storage keys, Javascript crashes, or unhandled promise drops.
* **Auto-Healer Action**: Clears target cache buffers (`localStorage.removeItem`), re-authenticates headers, and calls `api.syncFromSupabase()` to restore rendering in milliseconds.

### 🌐 C. API Gateway Rollover Healing
* **Anomaly**: Primary Deno webhook crashes or Meta Graph API experiences rate-limiting (`HTTP 429`).
* **Auto-Healer Action**: Switch outbound messaging queue dynamically to standby Edge functions or fallback offline databases.

---

## 🔒 2. Database Repair RPC Schema (PL/pgSQL)

When schema drift is identified, the healer triggers a definer function to apply migrations autonomously:

```sql
CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verify the table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        -- Add the missing column if it does not exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, p_column, p_type);
            RETURN TRUE;
        END IF;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🧠 3. Frontend State Rejuvenation Engine (TypeScript)

The client-side engine intercepts Javascript errors and executes state resets:

```typescript
import { api } from '../services/api';
import { supabase } from '../lib/supabaseClient';

export class StateHealingEngine {
  static async handleException(error: Error) {
    console.warn('[Auto-Healer] Intercepted runtime exception:', error.message);
    
    // 1. Log incident to the central telemetry table
    const { data: telemetry } = await supabase
      .from('system_health_telemetry')
      .insert({
        subsystem: 'frontend',
        severity: 'critical',
        error_code: error.name,
        error_stack: error.stack,
        status: 'healing'
      })
      .select()
      .single();

    // 2. Isolate and clear corrupt cache partitions
    const cacheKeys = ['whatsapp_sessions', 'reagents', 'pharmacy_inventory'];
    cacheKeys.forEach(k => localStorage.removeItem(k));

    // 3. Trigger database synchronization to pull healthy state
    try {
      await api.syncFromSupabase();
      
      // Update incident status to healed
      if (telemetry) {
        await supabase
          .from('system_health_telemetry')
          .update({ status: 'healed' })
          .eq('id', telemetry.id);
      }
      console.log('[Auto-Healer] Runtime state hot-rejuvenation complete! UI restored.');
    } catch (syncErr) {
      console.error('[Auto-Healer] Healing sync failed. Administrator intervention required.');
    }
  }
}
```

---

## 📊 4. DevSecOps Verification Protocols

To verify that the self-healing system is operating correctly under load, execute the automated fault-injection script:

```bash
# Runs the automated exception simulator to verify state flush and RLS rollover loops
node c:\Users\vivek\OneDrive\Desktop\Mediflow ecosystem\frontend\src\scratch\test_self_healing_system.cjs
```
Success is defined by the script recording the exception, executing the healer, and returning the dashboard status to `fully operational` in **under 500ms**.
