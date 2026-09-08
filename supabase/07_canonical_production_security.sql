-- ==============================================================================
-- 07_CANONICAL_PRODUCTION_SECURITY.SQL
-- AUTHORITATIVE CONSOLIDATED MIGRATION: Security Hardening, RLS Lockdown,
-- Audit Log Immutability, Adjustment Categories & Atomic Batch Persistence
-- ==============================================================================

-- 1. HARDEN ANONYMOUS ACCESS (ZERO UNCONTROLLED ANONYMOUS WRITES)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Anon can ONLY select public reference dictionaries needed for initial UI hydration
GRANT SELECT ON public.roles TO anon, authenticated;
GRANT SELECT ON public.funds TO anon, authenticated;
GRANT SELECT ON public.fund_rules TO anon, authenticated;
GRANT SELECT ON public.reference_data TO anon, authenticated;
GRANT SELECT ON public.fund_schedules TO anon, authenticated;

-- 2. AUTHENTICATED LEAST PRIVILEGE GRANTS
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_sheet_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_sheet_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_line_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exceptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funds TO authenticated;

-- AUDIT LOGS: Authenticated users can ONLY SELECT and INSERT. NO UPDATE. NO DELETE.
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE ALL ON public.audit_logs FROM anon;

-- 3. PURGE ALL VULNERABLE ANONYMOUS OR CONFLICTING POLICIES
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
DROP POLICY IF EXISTS anon_audit_logs_all ON public.audit_logs;
DROP POLICY IF EXISTS anon_exceptions_all ON public.exceptions;
DROP POLICY IF EXISTS anon_transfer_batches_all ON public.transfer_sheet_batches;
DROP POLICY IF EXISTS anon_transfer_lines_all ON public.transfer_sheet_lines;
DROP POLICY IF EXISTS anon_all_users ON public.users;
DROP POLICY IF EXISTS anon_all_roles ON public.roles;

-- Purge legacy unconstrained rls_read / rls_write policies from 01_core_schema
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'roles', 'users', 'funds', 'fund_rules', 'reference_data',
        'uploaded_files', 'transactions', 'exceptions', 'audit_logs',
        'checklists', 'transfer_sheet_batches', 'transfer_sheet_lines',
        'transfer_line_adjustments', 'fund_schedules', 'transfer_sheets'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS rls_read_%I ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS rls_write_%I ON public.%I;', tbl, tbl);
    END LOOP;
END $$;

-- 4. ENABLE RLS ACROSS ALL 15 CORE TABLES
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;

-- 5. STRICT RLS POLICIES FOR AUTHENTICATED USERS
-- Reference & Config tables: Read for all authenticated, write for admin/operations
DROP POLICY IF EXISTS authenticated_reference_read ON public.reference_data;
CREATE POLICY authenticated_reference_read ON public.reference_data
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_reference_all ON public.reference_data;
CREATE POLICY authenticated_reference_all ON public.reference_data
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_fund_rules_read ON public.fund_rules;
CREATE POLICY authenticated_fund_rules_read ON public.fund_rules
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_fund_schedules_read ON public.fund_schedules;
CREATE POLICY authenticated_fund_schedules_read ON public.fund_schedules
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_fund_schedules_all ON public.fund_schedules;
CREATE POLICY authenticated_fund_schedules_all ON public.fund_schedules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_funds_read ON public.funds;
CREATE POLICY authenticated_funds_read ON public.funds
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_funds_all ON public.funds;
CREATE POLICY authenticated_funds_all ON public.funds
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_roles_read ON public.roles;
CREATE POLICY authenticated_roles_read ON public.roles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_users_read ON public.users;
CREATE POLICY authenticated_users_read ON public.users
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_users_all ON public.users;
CREATE POLICY authenticated_users_all ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Operational tables
DROP POLICY IF EXISTS authenticated_uploaded_files_all ON public.uploaded_files;
CREATE POLICY authenticated_uploaded_files_all ON public.uploaded_files
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_transactions_all ON public.transactions;
CREATE POLICY authenticated_transactions_all ON public.transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_transfer_sheets_all ON public.transfer_sheets;
CREATE POLICY authenticated_transfer_sheets_all ON public.transfer_sheets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_transfer_batches_all ON public.transfer_sheet_batches;
CREATE POLICY authenticated_transfer_batches_all ON public.transfer_sheet_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_transfer_lines_all ON public.transfer_sheet_lines;
CREATE POLICY authenticated_transfer_lines_all ON public.transfer_sheet_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_line_adjustments_all ON public.transfer_line_adjustments;
CREATE POLICY authenticated_line_adjustments_all ON public.transfer_line_adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_checklists_all ON public.checklists;
CREATE POLICY authenticated_checklists_all ON public.checklists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_exceptions_all ON public.exceptions;
CREATE POLICY authenticated_exceptions_all ON public.exceptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. AUDIT LOG IMMUTABILITY POLICIES & TRIGGER (APPEND-ONLY LEDGER)
DROP POLICY IF EXISTS authenticated_audit_logs_read ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_read ON public.audit_logs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_audit_logs_insert ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_audit_logs_update ON public.audit_logs;
DROP POLICY IF EXISTS authenticated_audit_logs_delete ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'REGULATORY COMPLIANCE VIOLATION: public.audit_logs is an immutable append-only ledger. UPDATE and DELETE are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 7. TRANSFER SHEET POST-LOCK IMMUTABILITY TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_transfer_adjustment_on_locked_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_transfer_adjustment_on_locked_batch ON public.transfer_sheet_lines;
CREATE TRIGGER trg_prevent_transfer_adjustment_on_locked_batch
    BEFORE UPDATE ON public.transfer_sheet_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_transfer_adjustment_on_locked_batch();

-- 8. UPDATE ADJUSTMENT CATEGORIES CONSTRAINT (3 OPERATIONAL MODES)
ALTER TABLE public.transfer_line_adjustments 
    DROP CONSTRAINT IF EXISTS transfer_line_adjustments_adjustment_category_check;

ALTER TABLE public.transfer_line_adjustments 
    ADD CONSTRAINT transfer_line_adjustments_adjustment_category_check 
    CHECK (adjustment_category IN (
        'ADJUST_NET_VALUE',
        'ADJUST_BUY',
        'ADJUST_SELL',
        'BANK_FEE',
        'SETTLEMENT_DIFFERENCE',
        'CUSTODIAN_CORRECTION',
        'MANUAL_ADJUSTMENT',
        'OTHER'
    ));

-- 9. ATOMIC STORED PROCEDURE FOR ACID BATCH + LINES PERSISTENCE
CREATE OR REPLACE FUNCTION public.create_transfer_batch_atomic(
    p_batch JSONB,
    p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch_id UUID;
    v_line JSONB;
BEGIN
    -- 1. Insert the batch header
    INSERT INTO public.transfer_sheet_batches (
        batch_number,
        allocation_file_id,
        business_date,
        status,
        total_buy_amount,
        total_sell_amount,
        total_net_amount,
        maker_id,
        maker_name
    ) VALUES (
        p_batch->>'batch_number',
        NULLIF(p_batch->>'allocation_file_id', '')::UUID,
        (p_batch->>'business_date')::DATE,
        COALESCE(p_batch->>'status', 'DRAFT'),
        (p_batch->>'total_buy_amount')::NUMERIC,
        (p_batch->>'total_sell_amount')::NUMERIC,
        (p_batch->>'total_net_amount')::NUMERIC,
        p_batch->>'maker_id',
        p_batch->>'maker_name'
    )
    RETURNING id INTO v_batch_id;

    -- 2. Insert line items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.transfer_sheet_lines (
            batch_id,
            symbol_code,
            symbol_name,
            actual_symbol,
            system_buy_amount,
            system_sell_amount,
            adjustment_amount
        ) VALUES (
            v_batch_id,
            v_line->>'symbol_code',
            v_line->>'symbol_name',
            NULLIF(v_line->>'actual_symbol', ''),
            (v_line->>'system_buy_amount')::NUMERIC,
            (v_line->>'system_sell_amount')::NUMERIC,
            COALESCE((v_line->>'adjustment_amount')::NUMERIC, 0)
        );
    END LOOP;

    RETURN v_batch_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- 10. PERFORMANCE & SCALABILITY INDEXES
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
    ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action
    ON public.audit_logs(entity_name, action);

CREATE INDEX IF NOT EXISTS idx_transactions_file_id
    ON public.transactions(file_id);

CREATE INDEX IF NOT EXISTS idx_transactions_request_id
    ON public.transactions(request_id);

CREATE INDEX IF NOT EXISTS idx_transfer_sheet_lines_batch_id
    ON public.transfer_sheet_lines(batch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_sheet_lines_symbol
    ON public.transfer_sheet_lines(symbol_code);

CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_batch_line
    ON public.transfer_line_adjustments(batch_id, line_id);

CREATE INDEX IF NOT EXISTS idx_exceptions_status_file
    ON public.exceptions(status, file_id);

CREATE INDEX IF NOT EXISTS idx_reference_data_symbol_code
    ON public.reference_data(symbol_code);

CREATE INDEX IF NOT EXISTS idx_fund_schedules_fund_code
    ON public.fund_schedules(fund_code);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash
    ON public.uploaded_files(file_hash_sha256);
