-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 4: AUTH & PERMISSIONS FIX
-- Run this in the Supabase SQL Editor to resolve:
-- 1. "Email not confirmed" error for hussien.kamal and all users
-- 2. "Permission denied" errors on checklists, audit_logs, and exceptions
-- 3. Duplicate checklist items (cleans 16 items down to the 4 canonical steps)
-- ====================================================================

-- 1. AUTO-CONFIRM ALL EXISTING USERS (Instantly unlocks hussien.kamal@mubasher.net)
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 2. CREATE AUTO-CONFIRM TRIGGER FOR ALL FUTURE USERS
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. GRANT TABLE & SEQUENCE PRIVILEGES TO BOTH anon AND authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

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

-- 5. RLS POLICIES FOR CHECKLISTS, AUDIT_LOGS, AND EXCEPTIONS
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
CREATE POLICY anon_checklists_all ON public.checklists 
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_audit_logs_all ON public.audit_logs;
CREATE POLICY anon_audit_logs_all ON public.audit_logs 
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_exceptions_all ON public.exceptions;
CREATE POLICY anon_exceptions_all ON public.exceptions 
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_transfer_batches_all ON public.transfer_sheet_batches;
CREATE POLICY anon_transfer_batches_all ON public.transfer_sheet_batches 
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_transfer_lines_all ON public.transfer_sheet_lines;
CREATE POLICY anon_transfer_lines_all ON public.transfer_sheet_lines 
    FOR ALL TO anon USING (true) WITH CHECK (true);
