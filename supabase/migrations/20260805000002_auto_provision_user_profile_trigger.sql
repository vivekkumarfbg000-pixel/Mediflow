-- Migration ID: 20260805000002_auto_provision_user_profile_trigger
-- Purpose: Safely ensure email, display_name, updated_at columns exist on public.profiles,
-- and auto-provision a public.profiles row whenever a new user registers in auth.users.

-- 1. Safely add missing columns to public.profiles if they do not exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create or replace trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_display_name text;
BEGIN
  -- Extract metadata role or default to 'doctor'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'doctor'
  );

  -- Extract display_name
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Upsert matching row into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    consultation_fee,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_role,
    400.00,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent signup failures if trigger hits unexpected lock or constraint error
  RAISE WARNING 'handle_new_user_signup trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();
