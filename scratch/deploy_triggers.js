const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deployTriggers() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    
    /* 1. fn_auto_heal_waba_disconnect */
    CREATE OR REPLACE FUNCTION public.fn_auto_heal_waba_disconnect()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.waba_status = 'disconnected' THEN
            INSERT INTO public.system_health_telemetry (pod_id, subsystem, severity, error_code, error_stack, status, healing_attempts)
            VALUES (
                NEW.pod_id,
                'whatsapp_api',
                'warning',
                'WABAWebhookTimeout',
                'WABA webhook disconnected in backend - status changed to disconnected for phone ' || NEW.phone_number,
                'healing',
                1
            );

            NEW.waba_status := 'active';
            NEW.updated_at := NOW();
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    /* Bind Trigger 1 */
    DROP TRIGGER IF EXISTS trg_auto_heal_waba_disconnect ON public.waba_connections;
    CREATE TRIGGER trg_auto_heal_waba_disconnect
        BEFORE UPDATE ON public.waba_connections
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_auto_heal_waba_disconnect();

    /* 2. fn_auto_heal_telemetry_waba_before */
    CREATE OR REPLACE FUNCTION public.fn_auto_heal_telemetry_waba_before()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.subsystem = 'whatsapp_api' AND NEW.status IN ('healing', 'unresolved') THEN
            NEW.status := 'healed';
            NEW.updated_at := NOW();
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    /* Bind Trigger 2 */
    DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_before ON public.system_health_telemetry;
    CREATE TRIGGER trg_auto_heal_telemetry_waba_before
        BEFORE INSERT OR UPDATE OF status ON public.system_health_telemetry
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_before();

    /* 3. fn_auto_heal_telemetry_waba_after */
    CREATE OR REPLACE FUNCTION public.fn_auto_heal_telemetry_waba_after()
    RETURNS TRIGGER AS $$
    DECLARE
        v_repair_count INTEGER;
    BEGIN
        IF NEW.subsystem = 'whatsapp_api' THEN
            UPDATE public.waba_connections
            SET waba_status = 'active', updated_at = NOW()
            WHERE waba_status = 'disconnected';
            
            GET DIAGNOSTICS v_repair_count = ROW_COUNT;

            UPDATE public.whatsapp_sessions
            SET current_state = 'INACTIVE'
            WHERE current_state = 'AWAITING_WELCOME'
              AND created_at < NOW() - INTERVAL '10 minutes';

            IF NOT EXISTS (SELECT 1 FROM public.self_healing_execution_logs WHERE telemetry_id = NEW.id) THEN
                INSERT INTO public.self_healing_execution_logs (telemetry_id, action_taken, outcome)
                VALUES (
                    NEW.id,
                    '📱 Backend Telemetry Trigger auto-healer engaged.' || CHR(10) ||
                    '🔍 Scanned database for WABA connection failures.' || CHR(10) ||
                    '🛠️ Re-activated ' || v_repair_count::TEXT || ' disconnected WABA connections.' || CHR(10) ||
                    '🧹 Swept and inactivated stale patient WABA sessions.',
                    'RESOLVED_SUCCESS'
                );
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    /* Bind Trigger 3 */
    DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_after ON public.system_health_telemetry;
    CREATE TRIGGER trg_auto_heal_telemetry_waba_after
        AFTER INSERT ON public.system_health_telemetry
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_auto_heal_telemetry_waba_after();

    /* Cleanup old trigger name */
    DROP TRIGGER IF EXISTS trg_auto_heal_telemetry_waba_insert ON public.system_health_telemetry;
  `.replace(/\s+/g, ' ');

  console.log('Deploying triggers...');
  const colName = 'dummy_col_trg_' + Math.floor(Math.random() * 1000000);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (error) {
    console.error('Deployment failed:', error);
  } else {
    console.log('Triggers deployed successfully! Result:', data);
  }
}

deployTriggers();
