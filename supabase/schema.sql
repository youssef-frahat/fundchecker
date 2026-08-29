-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL MIGRATION SCRIPT (100% IDEMPOTENT)
-- Project: Investment Management Platform
-- Reusability: Can be executed repeatedly in Supabase SQL Editor without
--              "already exists" or conflict errors.
-- ====================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. ROLES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.roles (name, description) VALUES
('SUPER_ADMIN', 'Full system control, user management, and reopen capabilities'),
('OPERATIONS_USER', 'Standard operational file processing and review sign-off')
ON CONFLICT (name) DO NOTHING;

-- ====================================================================
-- 2. USERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- 2b. AUTH SYNCHRONIZATION TRIGGER (auth.users -> public.users)
-- Ensures any user created in Supabase Auth automatically gets a public profile
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role_id UUID;
    user_full_name TEXT;
BEGIN
    -- 1. Resolve default role (OPERATIONS_USER)
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'OPERATIONS_USER' LIMIT 1;

    -- If roles table was somehow empty, fallback to SUPER_ADMIN
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    END IF;

    -- 2. Extract full name or fallback to email prefix
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'Operations User'
    );

    -- 3. Insert profile into public.users
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
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- RETROACTIVE BACKFILL: Sync any users that already exist in auth.users
INSERT INTO public.users (id, email, full_name, role_id, status)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'Super Administrator'),
    (SELECT id FROM public.roles WHERE name = 'SUPER_ADMIN' LIMIT 1),
    'ACTIVE'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. FUNDS MASTER TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_code VARCHAR(50) UNIQUE NOT NULL,
    fund_name VARCHAR(255) NOT NULL,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- 4. DYNAMIC FUND SETTLEMENT RULES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.fund_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_type VARCHAR(10) NOT NULL,
    order_side VARCHAR(10) NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    is_transaction_value_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_quantity_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Clean up any pre-existing duplicates in fund_rules before creating constraint
DELETE FROM public.fund_rules a
USING public.fund_rules b
WHERE a.fund_type = b.fund_type
  AND a.order_side = b.order_side
  AND a.ctid < b.ctid;

-- Idempotent unique constraint on (fund_type, order_side)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_rule_per_type_side'
    ) THEN
        ALTER TABLE public.fund_rules
            ADD CONSTRAINT unique_rule_per_type_side UNIQUE (fund_type, order_side);
    END IF;
END $$;

INSERT INTO public.fund_rules (fund_type, order_side, is_transaction_value_visible, is_quantity_visible) VALUES
('T0', 'BUY', TRUE, TRUE),
('T0', 'SELL', TRUE, TRUE),
('T1', 'BUY', TRUE, FALSE),
('T1', 'SELL', FALSE, TRUE)
ON CONFLICT (fund_type, order_side) DO UPDATE SET
    is_transaction_value_visible = EXCLUDED.is_transaction_value_visible,
    is_quantity_visible = EXCLUDED.is_quantity_visible;

-- ====================================================================
-- 5. REFERENCE DATA & SYMBOL MAPPINGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.reference_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_code VARCHAR(50) NOT NULL,
    symbol_name VARCHAR(255) NOT NULL,
    actual_symbol VARCHAR(50) NOT NULL,
    email_contact VARCHAR(255),
    nav_unit_price NUMERIC(18, 5) DEFAULT 0,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    fund_id UUID REFERENCES public.funds(id),
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Idempotent column check for fund_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reference_data'
          AND column_name = 'fund_type'
    ) THEN
        ALTER TABLE public.reference_data
            ADD COLUMN fund_type VARCHAR(10) NOT NULL DEFAULT 'T0'
            CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP'));
    END IF;
END $$;

-- Clean up any pre-existing duplicate rows in reference_data before applying unique constraint
DELETE FROM public.reference_data a
USING public.reference_data b
WHERE a.symbol_code = b.symbol_code
  AND a.ctid < b.ctid;

-- Idempotent unique constraint on symbol_code to avoid duplicates on re-run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_reference_data_symbol_code'
    ) THEN
        ALTER TABLE public.reference_data
            ADD CONSTRAINT unique_reference_data_symbol_code UNIQUE (symbol_code);
    END IF;
END $$;

-- Reference data seed with ON CONFLICT (symbol_code) DO UPDATE
INSERT INTO public.reference_data (symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price, fund_type) VALUES
('1006',                  'Aafaq Investment Fund',      'AFAC',                  'Afaq Fund',                             264.2139,  'T0'),
('AHLAC',                 'AHLY A. CONTRACTORS FUND',   'AHLAC',                 'Tamayoz MMF',                           17.3411,   'T0'),
('Al Hayah',              'Al Hayah',                   'AlHayah',               'AlHayah - Hayat',                       0,         'T0'),
('Almezan',               'Almezan',                    'Almezan',               'Al Mizan',                              0,         'T0'),
('ARUP',                  'Arupe Cumulative Fund',       'AROPE',                 'AROPE Insurance Misr Fund',             0,         'T0'),
('1004',                  'Ataa Charity Fund',           'ATAA',                  'Ataa Fund',                             0,         'T0'),
('1001',                  'AZ - ADKHAR',                 'ADKHAR-AZ',             'ادخار / AZFI',                          21.13012,  'T0'),
('1010',                  'AZ - FORAS',                  'Azimut Stocks',         'Azimut Equity Opportunity Fund',        52.42922,  'T1'),
('1012',                  'AZ- ESTEHKAK - USD',          'STRC',                  'Azimut Target Maturity - USD',          10.50541,  'T1'),
('GOLD AZ',               'AZIMUT GOLD',                 'Gold AZ',               'AZ-GOLD',                               25.2991,   'T0'),
('Sabayek',               'Beltone Evolve Gold Fund',    'Sabayek',               'Sabayek',                               1.77656,   'T0'),
('1016',                  'Cash Mubasher Fund',          'CashMubasher',          'Cash Mubasher Fund Price',              24.03852,  'T0'),
('CIAM Building',         'CIAM Building',               'CIAM Building',         'CIAM Sectors Prices - CIAM Building',   21.46952,  'T0'),
('1018',                  'HORUS FUND',                  'Horus',                 'Horas MM',                              20.89333,  'T0'),
('kenzshariaa',           'KENZSHARIAA',                 'KENZSHARIAA',           'Kenz-Shareiaa - KENZSHARIAA',           181.07,    'T0'),
('1021',                  'Misr Al-Youm',                'Misr Al-Youm',          'Misr Al-Youm',                          19.40342,  'T0'),
('1014',                  'Misr Takaful Money Market',   'Misr Takaful',          'Misr Takaful Fund',                     212.05923, 'T1'),
('Mubasher Equity Fund',  'Mubasher Equity Fund',        'Mubasher Equity',       'Mubasher Equity Fund Price',            2.0182,    'T1'),
('Mubasher Gold',         'Mubasher Gold',               'Mubasher Gold',         'Dahab Mubasher - Mubasher Gold',        13.0276,   'T0'),
('1005',                  'NI Capital Money Market',     'NICapital',             'SIULA fund - NI MM FUND',               24.54846,  'T1'),
('ODIN IV',               'ODIN IV',                     'ODIN IV',               'ODIN MMF',                              1.25639,   'T0'),
('Shariah Compliant Fund','Shariah Compliant Fund',      'Shariah Compliant Fund','Misr Shariaa Equity Price',             22.42274,  'T1'),
('100-100',               'Tharawat 100/100',            'Tharawat - 100/100',    'Beltone EGX100 - Tharawat 100/100',     2.56203,   'T1'),
('Wafra',                 'Tharawat Wafra',              'Tharawat - Wafra',      'Beltone EGX33 - Tharawat Wafra',        2.18483,   'T1'),
('1011',                  'Wethaq Investment',           'IEIG',                  'Wethaq M.M',                            23.4454,   'T1')
ON CONFLICT (symbol_code) DO UPDATE SET
    symbol_name = EXCLUDED.symbol_name,
    actual_symbol = EXCLUDED.actual_symbol,
    email_contact = EXCLUDED.email_contact,
    nav_unit_price = EXCLUDED.nav_unit_price,
    fund_type = EXCLUDED.fund_type;

-- ====================================================================
-- 6. UPLOADED SOURCE FILES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'PARSED', 'EXCEPTION', 'FAILED', 'APPROVED', 'ARCHIVED'))
);

-- Idempotent check constraint upgrade for status
DO $$
BEGIN
    ALTER TABLE public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_status_check;
    ALTER TABLE public.uploaded_files ADD CONSTRAINT uploaded_files_status_check
        CHECK (status IN ('PROCESSING', 'PARSED', 'EXCEPTION', 'FAILED', 'APPROVED', 'ARCHIVED'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ====================================================================
-- 7. TRANSACTIONS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    request_id VARCHAR(100) NOT NULL,
    mubasher_no VARCHAR(100),
    customer_name VARCHAR(255),
    order_side VARCHAR(20) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    symbol_description TEXT,
    order_status VARCHAR(50),
    book_keeper VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'EGP',
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    order_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_commission NUMERIC(18, 4) DEFAULT 0,
    net_settle NUMERIC(18, 4) DEFAULT 0,
    cash_account_no VARCHAR(100),
    isin_code VARCHAR(50),
    order_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Clean up any pre-existing duplicates in transactions before adding constraint
DELETE FROM public.transactions a
USING public.transactions b
WHERE a.file_id = b.file_id
  AND a.request_id = b.request_id
  AND a.ctid < b.ctid;

-- Idempotent unique constraint on (file_id, request_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_file_request'
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT unique_file_request UNIQUE (file_id, request_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON public.transactions(file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON public.transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_request_id ON public.transactions(request_id);

-- ====================================================================
-- 8. EXCEPTIONS QUEUE TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    exception_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_payload JSONB,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'RESOLVED', 'IGNORED')),
    assigned_to UUID REFERENCES public.users(id),
    resolved_by UUID REFERENCES public.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_exceptions_file_id ON public.exceptions(file_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON public.exceptions(status);

-- ====================================================================
-- 9. GENERATED OUTPUT REPORTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id),
    fund_id UUID REFERENCES public.funds(id),
    report_version VARCHAR(50) NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'reports',
    file_size_bytes BIGINT,
    regeneration_reason TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_file_id ON public.generated_reports(file_id);

-- ====================================================================
-- 10. NETTING & TRANSFER SHEETS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.transfer_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id),
    fund_id UUID REFERENCES public.funds(id),
    group_by_field VARCHAR(50) NOT NULL DEFAULT 'symbol',
    total_buy NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_sell NUMERIC(18, 4) NOT NULL DEFAULT 0,
    net_transfer NUMERIC(18, 4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED')),
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_transfer_sheets_file_id ON public.transfer_sheets(file_id);

-- ====================================================================
-- 11. IMMUTABLE AUDIT TRAIL TABLE & TRIGGER
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE OR REPLACE FUNCTION public.prevent_audit_logs_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'OPERATION NOT PERMITTED: audit_logs is append-only and immutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_logs_tampering();

-- ====================================================================
-- 12. DYNAMIC CHECKLISTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_time VARCHAR(10) NOT NULL DEFAULT '12:00',
    priority VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by UUID REFERENCES public.users(id),
    completed_by_name VARCHAR(255),
    completed_at TIMESTAMP WITH TIME ZONE,
    reopened_by UUID REFERENCES public.users(id),
    reopened_by_name VARCHAR(255),
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopen_reason TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- 13. STORAGE BUCKET (STG-1, STG-3 REMEDIATION)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false,
    52428800,
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ====================================================================
-- 14. ROW-LEVEL SECURITY (RLS) POLICIES — 100% IDEMPOTENT
-- Every policy drops existing before recreation to eliminate "already exists"
-- ====================================================================

ALTER TABLE public.uploaded_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules        ENABLE ROW LEVEL SECURITY;

-- uploaded_files
DROP POLICY IF EXISTS rls_read_uploaded_files   ON public.uploaded_files;
DROP POLICY IF EXISTS rls_insert_uploaded_files ON public.uploaded_files;
DROP POLICY IF EXISTS rls_update_uploaded_files ON public.uploaded_files;
DROP POLICY IF EXISTS rls_read_all_authenticated ON public.uploaded_files;
DROP POLICY IF EXISTS rls_insert_files          ON public.uploaded_files;

CREATE POLICY rls_read_uploaded_files ON public.uploaded_files
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_uploaded_files ON public.uploaded_files
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY rls_update_uploaded_files ON public.uploaded_files
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- transactions
DROP POLICY IF EXISTS rls_read_transactions   ON public.transactions;
DROP POLICY IF EXISTS rls_insert_transactions ON public.transactions;
DROP POLICY IF EXISTS rls_read_tx_authenticated ON public.transactions;
DROP POLICY IF EXISTS rls_insert_tx          ON public.transactions;

CREATE POLICY rls_read_transactions ON public.transactions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_transactions ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- exceptions
DROP POLICY IF EXISTS rls_read_exceptions   ON public.exceptions;
DROP POLICY IF EXISTS rls_insert_exceptions ON public.exceptions;
DROP POLICY IF EXISTS rls_update_exceptions ON public.exceptions;
DROP POLICY IF EXISTS rls_read_exceptions_authenticated ON public.exceptions;

CREATE POLICY rls_read_exceptions ON public.exceptions
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_exceptions ON public.exceptions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY rls_update_exceptions ON public.exceptions
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- generated_reports
DROP POLICY IF EXISTS rls_read_generated_reports   ON public.generated_reports;
DROP POLICY IF EXISTS rls_insert_generated_reports ON public.generated_reports;
DROP POLICY IF EXISTS rls_read_reports_authenticated ON public.generated_reports;
DROP POLICY IF EXISTS rls_insert_reports           ON public.generated_reports;

CREATE POLICY rls_read_generated_reports ON public.generated_reports
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_generated_reports ON public.generated_reports
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- checklists
DROP POLICY IF EXISTS rls_read_checklists   ON public.checklists;
DROP POLICY IF EXISTS rls_update_checklists ON public.checklists;
DROP POLICY IF EXISTS rls_read_checklists_authenticated ON public.checklists;

CREATE POLICY rls_read_checklists ON public.checklists
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_update_checklists ON public.checklists
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- reference_data
DROP POLICY IF EXISTS rls_read_reference_data   ON public.reference_data;
DROP POLICY IF EXISTS rls_insert_reference_data ON public.reference_data;
DROP POLICY IF EXISTS rls_update_reference_data ON public.reference_data;
DROP POLICY IF EXISTS rls_read_refdata_authenticated ON public.reference_data;

CREATE POLICY rls_read_reference_data ON public.reference_data
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_reference_data ON public.reference_data
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY rls_update_reference_data ON public.reference_data
    FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- users / roles / funds / fund_rules
DROP POLICY IF EXISTS rls_read_users      ON public.users;
DROP POLICY IF EXISTS rls_read_roles      ON public.roles;
DROP POLICY IF EXISTS rls_read_funds      ON public.funds;
DROP POLICY IF EXISTS rls_read_fund_rules ON public.fund_rules;

CREATE POLICY rls_read_users      ON public.users      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_read_roles      ON public.roles      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_read_funds      ON public.funds      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_read_fund_rules ON public.fund_rules FOR SELECT USING (auth.uid() IS NOT NULL);

-- audit_logs
DROP POLICY IF EXISTS rls_read_audit_logs   ON public.audit_logs;
DROP POLICY IF EXISTS rls_insert_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS rls_read_audit_authenticated ON public.audit_logs;
DROP POLICY IF EXISTS rls_insert_audit     ON public.audit_logs;

CREATE POLICY rls_read_audit_logs ON public.audit_logs
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY rls_insert_audit_logs ON public.audit_logs
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND (user_id IS NULL OR user_id = auth.uid())
    );

-- transfer_sheets (Maker-Checker & Four-Eyes Governance)
DROP POLICY IF EXISTS rls_read_transfer_sheets        ON public.transfer_sheets;
DROP POLICY IF EXISTS rls_insert_transfer_sheets      ON public.transfer_sheets;
DROP POLICY IF EXISTS rls_submit_transfer_for_review  ON public.transfer_sheets;
DROP POLICY IF EXISTS rls_approve_transfer_sheet      ON public.transfer_sheets;
DROP POLICY IF EXISTS rls_read_transfer_authenticated ON public.transfer_sheets;
DROP POLICY IF EXISTS rls_insert_transfer             ON public.transfer_sheets;

CREATE POLICY rls_read_transfer_sheets ON public.transfer_sheets
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_insert_transfer_sheets ON public.transfer_sheets
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rls_submit_transfer_for_review ON public.transfer_sheets
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND status = 'DRAFT'
    )
    WITH CHECK (
        status = 'UNDER_REVIEW'
        AND reviewed_by = auth.uid()
    );

CREATE POLICY rls_approve_transfer_sheet ON public.transfer_sheets
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND status = 'UNDER_REVIEW'
        AND reviewed_by IS NOT NULL
        AND auth.uid() != reviewed_by
    )
    WITH CHECK (
        status = 'APPROVED'
        AND approved_by = auth.uid()
        AND auth.uid() != reviewed_by
    );

-- storage.objects policies (STG-3 REMEDIATION)
DROP POLICY IF EXISTS storage_reports_select ON storage.objects;
DROP POLICY IF EXISTS storage_reports_insert ON storage.objects;
DROP POLICY IF EXISTS storage_reports_update ON storage.objects;

CREATE POLICY storage_reports_select ON storage.objects
    FOR SELECT USING (bucket_id = 'reports' AND auth.uid() IS NOT NULL);

CREATE POLICY storage_reports_insert ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.uid() IS NOT NULL);

CREATE POLICY storage_reports_update ON storage.objects
    FOR UPDATE USING (bucket_id = 'reports' AND auth.uid() IS NOT NULL);
