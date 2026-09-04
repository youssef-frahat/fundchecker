-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 4: AUTH & PERMISSIONS FIX (V2)
-- ====================================================================

-- 1. AUTO-CONFIRM ALL EXISTING USERS (Instantly unlocks hussien.kamal@mubasher.net)
-- Note: "confirmed_at" is a generated column in Supabase Auth, only update "email_confirmed_at"
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 2. CREATE AUTO-CONFIRM TRIGGER FOR ALL FUTURE USERS
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. GRANT TABLE & SEQUENCE PRIVILEGES TO authenticated (LEAST PRIVILEGE)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.roles, public.funds, public.fund_rules, public.reference_data, public.fund_schedules TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Ensure public cannot mutate tables
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 4. CLEAN UP DUPLICATE CHECKLISTS (Keep only 1 record per checklist_code)
DELETE FROM public.checklists 
WHERE id NOT IN (
    SELECT DISTINCT ON (checklist_code) id 
    FROM public.checklists 
    ORDER BY checklist_code, created_at ASC
);

-- Ensure checklist_code is unique
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS uq_checklist_code;
ALTER TABLE public.checklists ADD CONSTRAINT uq_checklist_code UNIQUE (checklist_code);

-- Re-seed the 4 canonical operational steps if missing
INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory) VALUES
('CHK-01', 'Daily Allocation File Upload & Verification', 'Upload and verify 39-column allocation file.', '09:30', 'CRITICAL', TRUE),
('CHK-02', 'T0 / T1 Fund Settlement Review', 'Review generated calculations based on Allocated Qty x Price.', '11:00', 'HIGH', TRUE),
('CHK-03', 'Transfer Sheet Maker Sign-off', 'Review System Net Transfer and enter manual adjustments.', '13:00', 'CRITICAL', TRUE),
('CHK-04', 'Checker 4-Eyes Review & Approval', 'Approve and lock final transfer settlement sheet.', '15:00', 'CRITICAL', TRUE)
ON CONFLICT (checklist_code) DO NOTHING;

-- 5. ENSURE RLS POLICIES FOR AUTHENTICATED ACCESS
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
DROP POLICY IF EXISTS anon_audit_logs_all ON public.audit_logs;
DROP POLICY IF EXISTS anon_exceptions_all ON public.exceptions;
DROP POLICY IF EXISTS anon_transfer_batches_all ON public.transfer_sheet_batches;
DROP POLICY IF EXISTS anon_transfer_lines_all ON public.transfer_sheet_lines;

