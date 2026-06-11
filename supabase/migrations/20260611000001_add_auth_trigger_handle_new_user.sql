-- Migration: Add auth.users trigger for handle_new_user function
-- This ensures that when a new user signs up via Supabase Auth, the handle_new_user function
-- is called to automatically create a profile entry in public.profiles

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;