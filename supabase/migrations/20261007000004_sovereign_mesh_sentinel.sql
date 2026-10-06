-- ============================================================================
-- 🏛️ VITALSYNC CLINIC OS: PHASE 24 SOVEREIGN MESH & DEPLOYMENT SENTINEL MIGRATION
-- File: supabase/migrations/20261007000004_sovereign_mesh_sentinel.sql
-- ============================================================================

-- 1. Create mesh_node_heartbeats table for multi-counter terminal mesh tracking
CREATE TABLE IF NOT EXISTS public.mesh_node_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL,
  node_id TEXT NOT NULL,
  node_role TEXT DEFAULT 'counter',
  last_sequence_id BIGINT DEFAULT 0,
  status TEXT DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Composite Unique Index on pod_id + node_id to allow upserts from active clinic terminals
CREATE UNIQUE INDEX IF NOT EXISTS idx_mesh_node_heartbeats_pod_node
  ON public.mesh_node_heartbeats (pod_id, node_id);

-- Performance Index for Node Status Audits
CREATE INDEX IF NOT EXISTS idx_mesh_node_heartbeats_status
  ON public.mesh_node_heartbeats (pod_id, status, last_seen DESC);

-- 2. Create deployment_audit_logs table for zero-downtime client version tracking
CREATE TABLE IF NOT EXISTS public.deployment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  deployed_by TEXT DEFAULT 'ci_sentinel',
  pod_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deployment_audit_logs_version
  ON public.deployment_audit_logs (version, created_at DESC);

-- 3. Enable Row Level Security & Establish Permissive Access Policies
ALTER TABLE public.mesh_node_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- mesh_node_heartbeats Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mesh_node_heartbeats' AND policyname = 'mesh_node_heartbeats_read_all'
  ) THEN
    CREATE POLICY mesh_node_heartbeats_read_all ON public.mesh_node_heartbeats
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mesh_node_heartbeats' AND policyname = 'mesh_node_heartbeats_write_all'
  ) THEN
    CREATE POLICY mesh_node_heartbeats_write_all ON public.mesh_node_heartbeats
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- deployment_audit_logs Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deployment_audit_logs' AND policyname = 'deployment_audit_logs_read_all'
  ) THEN
    CREATE POLICY deployment_audit_logs_read_all ON public.deployment_audit_logs
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deployment_audit_logs' AND policyname = 'deployment_audit_logs_write_all'
  ) THEN
    CREATE POLICY deployment_audit_logs_write_all ON public.deployment_audit_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
