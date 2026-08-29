-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 2: AUTH SYNCHRONIZATION TRIGGER
-- Run this AFTER 01_core_schema.sql has completed.
-- Connects auth.users -> public.users safely and idempotently.
-- ====================================================================

-- 1. Create synchronization function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role_id UUID;
    user_full_name TEXT;
    requested_role TEXT;
BEGIN
    -- Resolve role from metadata if provided, otherwise default to OPERATIONS_USER
    requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATIONS_USER');
    SELECT id INTO default_role_id FROM public.roles WHERE name = requested_role LIMIT 1;
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'OPERATIONS_USER' LIMIT 1;
    END IF;
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    END IF;

    -- Extract full name from metadata or email prefix
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'Operations User'
    );

    -- Insert or update public profile
    INSERT INTO public.users (id, email, full_name, role_id, status)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        default_role_id,
        'ACTIVE'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role_id = COALESCE(EXCLUDED.role_id, public.users.role_id);

    RETURN NEW;
END;
$$;

-- 2. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Retroactive backfill: Sync existing users from auth.users to public.users
INSERT INTO public.users (id, email, full_name, role_id, status)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'Super Administrator'),
    COALESCE(
        (SELECT id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1),
        (SELECT id FROM public.roles LIMIT 1)
    ),
    'ACTIVE'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;
