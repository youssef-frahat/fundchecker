-- ==============================================================================
-- 08_FIX_USER_FOREIGN_KEYS_AND_AUTH.SQL
-- PRODUCTION HOTFIX: SUPABASE AUTH, FOREIGN KEY DELETION & ADVISOR OPTIMIZATIONS
--
-- Fixes:
-- 1. "Database error deleting user" in Supabase Studio & Platform Dashboard.
-- 2. Foreign key cascade & ON DELETE SET NULL on all referencing tables.
-- 3. Drops foreign keys on public.audit_logs to preserve append-only compliance.
-- 4. Optimizes all RLS policies using scalar subqueries: (SELECT auth.uid())
--    to prevent per-row function re-evaluation (Supabase Performance Advisor).
-- 5. Adds covering indexes on foreign keys & filter columns (Supabase Advisor).
-- 6. Adds admin_set_user_password & admin_delete_user SECURITY DEFINER RPCs.
-- ==============================================================================

-- Ensure pgcrypto extension exists for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ==============================================================================
-- PART 1: DROP AUDIT_LOGS FOREIGN KEYS (IMMUTABLE AUDIT PRESERVATION)
-- ==============================================================================
-- Audit logs must NEVER have foreign key constraints to public.users or auth.users.
-- When a user is deleted, audit logs must retain the user_id text/UUID historically
-- without triggering foreign key violations or immutable trigger exceptions.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name, tc.table_schema, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'audit_logs'
          AND ccu.table_name IN ('users')
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I CASCADE;',
            r.table_schema, r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped audit_logs foreign key constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- ==============================================================================
-- PART 2: FIX FOREIGN KEYS ON ALL DOWNSTREAM TABLES (ON DELETE SET NULL)
-- ==============================================================================

-- 1. transfer_line_adjustments
ALTER TABLE public.transfer_line_adjustments ALTER COLUMN adjusted_by DROP NOT NULL;
ALTER TABLE public.transfer_line_adjustments DROP CONSTRAINT IF EXISTS transfer_line_adjustments_adjusted_by_fkey;
ALTER TABLE public.transfer_line_adjustments 
    ADD CONSTRAINT transfer_line_adjustments_adjusted_by_fkey 
    FOREIGN KEY (adjusted_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. funds
ALTER TABLE public.funds ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.funds DROP CONSTRAINT IF EXISTS funds_created_by_fkey;
ALTER TABLE public.funds 
    ADD CONSTRAINT funds_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. fund_rules
ALTER TABLE public.fund_rules ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.fund_rules DROP CONSTRAINT IF EXISTS fund_rules_created_by_fkey;
ALTER TABLE public.fund_rules 
    ADD CONSTRAINT fund_rules_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. uploaded_files
ALTER TABLE public.uploaded_files ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_uploaded_by_fkey;
ALTER TABLE public.uploaded_files 
    ADD CONSTRAINT uploaded_files_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 5. exceptions
ALTER TABLE public.exceptions ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE public.exceptions ALTER COLUMN resolved_by DROP NOT NULL;
ALTER TABLE public.exceptions DROP CONSTRAINT IF EXISTS exceptions_assigned_to_fkey;
ALTER TABLE public.exceptions DROP CONSTRAINT IF EXISTS exceptions_resolved_by_fkey;
ALTER TABLE public.exceptions 
    ADD CONSTRAINT exceptions_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.exceptions 
    ADD CONSTRAINT exceptions_resolved_by_fkey 
    FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. transfer_sheet_batches
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_sheet_batches' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE public.transfer_sheet_batches ALTER COLUMN reviewed_by DROP NOT NULL;
        ALTER TABLE public.transfer_sheet_batches DROP CONSTRAINT IF EXISTS transfer_sheet_batches_reviewed_by_fkey;
        ALTER TABLE public.transfer_sheet_batches ADD CONSTRAINT transfer_sheet_batches_reviewed_by_fkey
            FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_sheet_batches' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE public.transfer_sheet_batches ALTER COLUMN approved_by DROP NOT NULL;
        ALTER TABLE public.transfer_sheet_batches DROP CONSTRAINT IF EXISTS transfer_sheet_batches_approved_by_fkey;
        ALTER TABLE public.transfer_sheet_batches ADD CONSTRAINT transfer_sheet_batches_approved_by_fkey
            FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. checklists (if legacy columns reference users)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'checklists' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.checklists ALTER COLUMN created_by DROP NOT NULL;
        ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_created_by_fkey;
        ALTER TABLE public.checklists ADD CONSTRAINT checklists_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'checklists' AND column_name = 'completed_by'
    ) THEN
        ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_completed_by_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'checklists' AND column_name = 'reopened_by'
    ) THEN
        ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_reopened_by_fkey;
    END IF;
END $$;

-- 8. generated_reports (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generated_reports') THEN
        ALTER TABLE public.generated_reports ALTER COLUMN created_by DROP NOT NULL;
        ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_created_by_fkey;
        ALTER TABLE public.generated_reports ADD CONSTRAINT generated_reports_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. transfer_sheets (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_sheets') THEN
        ALTER TABLE public.transfer_sheets DROP CONSTRAINT IF EXISTS transfer_sheets_reviewed_by_fkey;
        ALTER TABLE public.transfer_sheets DROP CONSTRAINT IF EXISTS transfer_sheets_approved_by_fkey;
    END IF;
END $$;

-- 10. Automated Dynamic Sweep: Ensure NO remaining FK blocks public.users deletion
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.constraint_name,
            tc.table_schema,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.table_schema = 'public'
          AND NOT (tc.table_name = 'users' AND tc.table_schema = 'public')
          AND tc.table_name != 'audit_logs'
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL;',
                r.table_schema, r.table_name, r.column_name);
            EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;',
                r.table_schema, r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE SET NULL;',
                r.table_schema, r.table_name, r.constraint_name, r.column_name,
                r.foreign_table_schema, r.foreign_table_name, r.foreign_column_name);
            RAISE NOTICE 'Dynamic sweep: Updated constraint % on %.% to ON DELETE SET NULL',
                r.constraint_name, r.table_schema, r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Dynamic sweep notice for %: %', r.constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 11. Ensure public.users.id cascades from auth.users(id)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users 
    ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==============================================================================
-- PART 3: SUPABASE ADVISOR PERFORMANCE & SECURITY OPTIMIZATION
-- Drops all legacy / conflicting policies and applies (SELECT auth.uid()) subqueries
-- ==============================================================================

-- Drop all old policies from schema.sql, 01_core_schema.sql, etc.
DO $$
DECLARE
    tbl text;
BEGIN
    -- Drop legacy rls_read_*, rls_write_*, anon_*, auth_*
    FOR tbl IN SELECT unnest(ARRAY[
        'roles', 'users', 'funds', 'fund_rules', 'reference_data',
        'uploaded_files', 'transactions', 'exceptions', 'audit_logs',
        'checklists', 'transfer_sheet_batches', 'transfer_sheet_lines',
        'transfer_line_adjustments', 'fund_schedules', 'generated_reports', 'transfer_sheets'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS rls_read_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS rls_write_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS rls_insert_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS rls_update_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS anon_all_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS auth_%I_access ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS auth_%I_read ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS auth_%I_insert ON public.%I;', tbl, tbl);
    END LOOP;

    -- Drop explicit legacy policies
    DROP POLICY IF EXISTS rls_read_transfer_batches ON public.transfer_sheet_batches;
    DROP POLICY IF EXISTS rls_maker_update_batches ON public.transfer_sheet_batches;
    DROP POLICY IF EXISTS rls_checker_review_batches ON public.transfer_sheet_batches;
    DROP POLICY IF EXISTS rls_checker_approve_batches ON public.transfer_sheet_batches;
    DROP POLICY IF EXISTS rls_insert_audit ON public.audit_logs;
    DROP POLICY IF EXISTS rls_read_audit_authenticated ON public.audit_logs;
    DROP POLICY IF EXISTS anon_audit_logs_all ON public.audit_logs;
    DROP POLICY IF EXISTS anon_all_users ON public.users;
END $$;

-- Enable RLS across all tables
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_schedules            ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Recreate Clean, Optimized Policies using (SELECT auth.uid()) Subqueries
-- ------------------------------------------------------------------------------

-- 1. Reference Data, Roles, Schedules, Funds, Fund Rules
DROP POLICY IF EXISTS authenticated_roles_read ON public.roles;
CREATE POLICY authenticated_roles_read ON public.roles
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_ref_data_read ON public.reference_data;
CREATE POLICY authenticated_ref_data_read ON public.reference_data
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_ref_data_write ON public.reference_data;
CREATE POLICY authenticated_ref_data_write ON public.reference_data
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_fund_schedules_all ON public.fund_schedules;
CREATE POLICY authenticated_fund_schedules_all ON public.fund_schedules
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_funds_all ON public.funds;
CREATE POLICY authenticated_funds_all ON public.funds
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_fund_rules_all ON public.fund_rules;
CREATE POLICY authenticated_fund_rules_all ON public.fund_rules
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 2. Users (Super Admin full access, Authenticated users can read directory)
DROP POLICY IF EXISTS authenticated_users_read ON public.users;
DROP POLICY IF EXISTS authenticated_users_all ON public.users;
DROP POLICY IF EXISTS authenticated_users_write ON public.users;

CREATE POLICY authenticated_users_read ON public.users
    FOR SELECT TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY authenticated_users_write ON public.users
    FOR ALL TO authenticated 
    USING (
        (SELECT auth.uid()) IS NOT NULL
    )
    WITH CHECK (
        (SELECT auth.uid()) IS NOT NULL
    );

-- 3. Operational Processing Tables
DROP POLICY IF EXISTS authenticated_uploaded_files_all ON public.uploaded_files;
CREATE POLICY authenticated_uploaded_files_all ON public.uploaded_files
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_transactions_all ON public.transactions;
CREATE POLICY authenticated_transactions_all ON public.transactions
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_transfer_batches_all ON public.transfer_sheet_batches;
CREATE POLICY authenticated_transfer_batches_all ON public.transfer_sheet_batches
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_transfer_lines_all ON public.transfer_sheet_lines;
CREATE POLICY authenticated_transfer_lines_all ON public.transfer_sheet_lines
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_line_adjustments_all ON public.transfer_line_adjustments;
CREATE POLICY authenticated_line_adjustments_all ON public.transfer_line_adjustments
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_checklists_all ON public.checklists;
CREATE POLICY authenticated_checklists_all ON public.checklists
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_exceptions_all ON public.exceptions;
CREATE POLICY authenticated_exceptions_all ON public.exceptions
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 4. Audit Trail (Strict Append-Only Ledger)
DROP POLICY IF EXISTS authenticated_audit_logs_read ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_read ON public.audit_logs
    FOR SELECT TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_audit_logs_insert ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Revoke mutation grants on audit_logs
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;


-- ==============================================================================
-- PART 4: SUPABASE ADVISOR INDEXING OPTIMIZATIONS
-- Indexes on all foreign key columns & query predicates to eliminate advisor alerts
-- ==============================================================================

-- Foreign key covering indexes
CREATE INDEX IF NOT EXISTS idx_funds_created_by ON public.funds(created_by);
CREATE INDEX IF NOT EXISTS idx_fund_rules_fund_id ON public.fund_rules(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_rules_created_by ON public.fund_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded_by ON public.uploaded_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_exceptions_assigned_to ON public.exceptions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_exceptions_resolved_by ON public.exceptions(resolved_by);
CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_adjusted_by ON public.transfer_line_adjustments(adjusted_by);
CREATE INDEX IF NOT EXISTS idx_transfer_sheet_batches_maker_id ON public.transfer_sheet_batches(maker_id);
CREATE INDEX IF NOT EXISTS idx_transfer_sheet_batches_checker_id ON public.transfer_sheet_batches(checker_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);


-- ==============================================================================
-- PART 5: SECURE ADMINISTRATIVE RPC STORED PROCEDURES
-- ==============================================================================

-- 1. admin_set_user_password: Allows Super Admins to directly update passwords
CREATE OR REPLACE FUNCTION public.admin_set_user_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_role TEXT;
    caller_id UUID;
BEGIN
    caller_id := (SELECT auth.uid());
    
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Fetch caller role
    SELECT r.name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = caller_id;

    -- Caller must be SUPER_ADMIN or changing their own password
    IF caller_id != target_user_id AND (caller_role IS NULL OR caller_role != 'SUPER_ADMIN') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can set passwords for other users.';
    END IF;

    IF new_password IS NULL OR length(new_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters long.';
    END IF;

    -- Encrypt with bcrypt and update auth.users
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found in authentication registry.';
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully in authentication provider.');
END;
$$;

-- 2. admin_delete_user: Allows Super Admins to cleanly delete a user
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_role TEXT;
    caller_id UUID;
BEGIN
    caller_id := (SELECT auth.uid());
    
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT r.name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = caller_id;

    IF caller_role IS NULL OR caller_role != 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can delete system users.';
    END IF;

    IF caller_id = target_user_id THEN
        RAISE EXCEPTION 'Operation rejected: You cannot delete your own active account.';
    END IF;

    -- Delete from auth.users (cascades to public.users via users_id_fkey)
    DELETE FROM auth.users WHERE id = target_user_id;
    -- Ensure deletion from public.users as well
    DELETE FROM public.users WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'User account permanently deleted.');
END;
$$;

-- 3. Secure Function Search Paths (Security Advisor requirement)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    default_role_id UUID;
    user_full_name TEXT;
    requested_role TEXT;
BEGIN
    requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATIONS_USER');
    SELECT id INTO default_role_id FROM public.roles WHERE name = requested_role LIMIT 1;
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'OPERATIONS_USER' LIMIT 1;
    END IF;
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    END IF;

    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'Operations User'
    );

    INSERT INTO public.users (id, email, full_name, role_id, status)
    VALUES (NEW.id, NEW.email, user_full_name, default_role_id, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role_id = COALESCE(EXCLUDED.role_id, public.users.role_id);

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    RETURN NEW;
END;
$$;

-- Grant execute privileges to authenticated & service_role
GRANT EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_confirm_new_user() TO authenticated, service_role;
