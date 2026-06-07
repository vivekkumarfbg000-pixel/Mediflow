-- Migration: Fix RLS recursion issue by converting is_platform_admin from sql to plpgsql
-- This prevents PostgreSQL from inlining the function and causing planning-time infinite loops on profiles/entities tables.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'platform_admin'
  ) INTO v_is_admin;
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
