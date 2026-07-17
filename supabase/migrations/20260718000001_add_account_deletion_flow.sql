-- Migration: Add account deletion flow
-- Creates a SECURITY DEFINER function to permit authenticated users to delete their own account.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Verify caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete account' USING ERRCODE = 'auth0';
  END IF;

  -- 2. Delete from auth.users (cascades to profiles and clears user records)
  -- The SECURITY DEFINER runs as database superuser, permitting deletion from auth.users.
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Revoke public execution to ensure only authenticated users can run it
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS 'Deletes the currently authenticated user account and cascades profile removal.';
