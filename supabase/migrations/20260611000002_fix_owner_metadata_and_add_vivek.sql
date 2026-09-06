-- Migration: Fix owner@mediflow.com user_metadata and add vivekkumarfbg000@gmail.com user

-- 1. Fix owner@mediflow.com user_metadata role from 'patient' to 'platform_admin'
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "platform_admin", "display_name": "SaaS Platform Owner", "pod_id": "dfb2a1a8-8e68-4f8a-929e-4a6c8e317009"}'::jsonb
WHERE email = 'owner@mediflow.com';

-- 2. Create vivekkumarfbg000@gmail.com user with platform_admin role
-- Only create if doesn't exist
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    created_at,
    updated_at
)
SELECT
    'dfb2a1a8-8e68-4f8a-929e-4a6c8e317110',
    instance_id,
    'vivekkumarfbg000@gmail.com',
    encrypted_password,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"role": "platform_admin", "display_name": "Vivek Kumar", "pod_id": "dfb2a1a8-8e68-4f8a-929e-4a6c8e317009"}'::jsonb,
    false,
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'doctor@mediflow.com'
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'vivekkumarfbg000@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- 3. Create profile for vivekkumarfbg000@gmail.com if it doesn't exist
INSERT INTO public.profiles (id, entity_id, role, display_name, consultation_fee)
SELECT 
    u.id,
    'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
    'platform_admin',
    'Vivek Kumar',
    0.00
FROM auth.users u
WHERE u.email = 'vivekkumarfbg000@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    entity_id = EXCLUDED.entity_id,
    display_name = EXCLUDED.display_name;

-- 4. Also update doctor@mediflow.com, labtech@mediflow.com, pharmacist@mediflow.com to include pod_id in user_metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{pod_id}',
    (SELECT to_jsonb(p.id::text) FROM public.pods p WHERE p.clinic_code = 'MF-0001' LIMIT 1)
)
WHERE email IN ('doctor@mediflow.com', 'labtech@mediflow.com', 'pharmacist@mediflow.com')
AND (raw_user_meta_data->>'pod_id') IS NULL;