-- ==============================================================================
-- 03_SECURITY_RLS_LOCKDOWN.SQL
-- Enterprise Row-Level Security & Role Authorization Lockdown
-- Zero-Overhead Security Policies for Egyptian Fund Clearing Operations
-- ==============================================================================

-- 1. Enable RLS across all 14 core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Revoke all public anonymous table mutations
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 3. Read permissions for authenticated users
CREATE POLICY authenticated_users_read ON public.users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_roles_read ON public.roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_reference_read ON public.reference_data
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_fund_rules_read ON public.fund_rules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_fund_schedules_read ON public.fund_schedules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_uploaded_files_all ON public.uploaded_files
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_transactions_all ON public.transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_transfer_sheets_all ON public.transfer_sheets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_transfer_batches_all ON public.transfer_sheet_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_transfer_lines_all ON public.transfer_sheet_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_line_adjustments_all ON public.transfer_line_adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_checklists_all ON public.checklists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_exceptions_all ON public.exceptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_audit_logs_read ON public.audit_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Database Trigger: Post-Lock Immutability on Transfer Sheet Lines
CREATE OR REPLACE FUNCTION public.prevent_transfer_adjustment_on_locked_batch()
RETURNS TRIGGER AS $$
DECLARE
    batch_status VARCHAR(30);
BEGIN
    SELECT status INTO batch_status
    FROM public.transfer_sheet_batches
    WHERE id = NEW.batch_id;

    IF batch_status IN ('LOCKED', 'APPROVED') THEN
        RAISE EXCEPTION 'CRITICAL INTEGRITY VIOLATION: Cannot modify transfer lines on a LOCKED or APPROVED batch (%)', NEW.batch_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_transfer_adjustment_on_locked_batch ON public.transfer_sheet_lines;
CREATE TRIGGER trg_prevent_transfer_adjustment_on_locked_batch
    BEFORE UPDATE ON public.transfer_sheet_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_transfer_adjustment_on_locked_batch();

-- 5. Business Date Dedup Index on Normalized Transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_req_date 
    ON public.transactions(request_id, order_date);
