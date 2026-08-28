-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL MIGRATION SCRIPT
-- Project: Investment Management Platform
-- Target Supabase Instance: https://xclvydhlmxmzcwwprwfk.supabase.co
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROLES TABLE
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

-- 2. USERS TABLE
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

-- 3. FUNDS MASTER TABLE
CREATE TABLE IF NOT EXISTS public.funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_code VARCHAR(50) UNIQUE NOT NULL,
    fund_name VARCHAR(255) NOT NULL,
    fund_type VARCHAR(50) NOT NULL DEFAULT 'T0',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. DYNAMIC FUND SETTLEMENT RULES TABLE
CREATE TABLE IF NOT EXISTS public.fund_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_type VARCHAR(50) NOT NULL,
    order_side VARCHAR(10) NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    is_transaction_value_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_quantity_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_rule_per_type_side UNIQUE (fund_type, order_side)
);

INSERT INTO public.fund_rules (fund_type, order_side, is_transaction_value_visible, is_quantity_visible) VALUES
('T0', 'BUY', TRUE, TRUE),
('T0', 'SELL', TRUE, TRUE),
('T1', 'BUY', TRUE, FALSE),  -- T1 BUY: Value Visible, Qty Empty
('T1', 'SELL', FALSE, TRUE)  -- T1 SELL: Value Empty, Qty Visible
ON CONFLICT ON CONSTRAINT unique_rule_per_type_side DO NOTHING;

-- 5. REFERENCE DATA & SYMBOL MAPPINGS TABLE
CREATE TABLE IF NOT EXISTS public.reference_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_code VARCHAR(50) NOT NULL,       -- الرمز (e.g. 1006, AHLAC)
    symbol_name VARCHAR(255) NOT NULL,      -- الاسم (e.g. Aafaq Investment Fund)
    actual_symbol VARCHAR(50) NOT NULL,    -- الرمز2 (e.g. AFAC)
    email_contact VARCHAR(255),             -- Email for notifications
    nav_unit_price NUMERIC(18, 5) DEFAULT 0,-- سعر الوثيقة الواحدة
    fund_id UUID REFERENCES public.funds(id),
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- SEED REFERENCE DATA MATCHING USER SCREENSHOT 2
INSERT INTO public.reference_data (symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price) VALUES
('1006', 'Aafaq Investment Fund', 'AFAC', 'Afaq Fund', 264.2139),
('AHLAC', 'AHLY A. CONTRACTORS FUND', 'AHLAC', 'Tamayoz MMF', 17.3411),
('Al Hayah', 'Al Hayah', 'AlHayah', 'AlHayah - Hayat', 0),
('Almezan', 'Almezan', 'Almezan', 'Al Mizan', 0),
('ARUP', 'Arupe Cumulative Fund', 'AROPE', 'AROPE Insurance Misr Fund', 0),
('1004', 'Ataa Charity Fund', 'ATAA', 'Ataa Fund', 0),
('1001', 'AZ - ADKHAR', 'ADKHAR-AZ', 'ادخار / AZFI', 21.13012),
('1010', 'AZ - FORAS', 'Azimut Stocks', 'Azimut Equity Opportunity Fund', 52.42922),
('1012', 'AZ- ESTEHKAK - USD', 'STRC', 'Azimut Target Maturity - USD', 10.50541),
('GOLD AZ', 'AZIMUT GOLD', 'Gold AZ', 'AZ-GOLD', 25.2991),
('Sabayek', 'Beltone Evolve Gold Fund', 'Sabayek', 'Sabayek', 1.77656),
('1016', 'Cash Mubasher Fund', 'CashMubasher', 'Cash Mubasher Fund Price', 24.03852),
('CIAM Building', 'CIAM Building', 'CIAM Building', 'CIAM Sectors Prices - CIAM Building', 21.46952),
('1018', 'HORUS FUND', 'Horus', 'Horas MM', 20.89333),
('kenzshariaa', 'KENZSHARIAA', 'KENZSHARIAA', 'Kenz-Shareiaa - KENZSHARIAA', 181.07),
('1021', 'Misr Al-Youm', 'Misr Al-Youm', 'Misr Al-Youm', 19.40342),
('1014', 'Misr Takaful Money Market', 'Misr Takaful', 'Misr Takaful Fund', 212.05923),
('Mubasher Equity Fund', 'Mubasher Equity Fund', 'Mubasher Equity', 'Mubasher Equity Fund Price', 2.0182),
('Mubasher Gold', 'Mubasher Gold', 'Mubasher Gold', 'Dahab Mubasher - Mubasher Gold', 13.0276),
('1005', 'NI Capital Money Market', 'NICapital', 'SIULA fund - NI MM FUND', 24.54846),
('ODIN IV', 'ODIN IV', 'ODIN IV', 'ODIN MMF', 1.25639),
('Shariah Compliant Fund', 'Shariah Compliant Fund', 'Shariah Compliant Fund', 'Misr Shariaa Equity Price', 22.42274),
('100-100', 'Tharawat 100/100', 'Tharawat - 100/100', 'Beltone EGX100 - Tharawat 100/100', 2.56203),
('Wafra', 'Tharawat Wafra', 'Tharawat - Wafra', 'Beltone EGX33 - Tharawat Wafra', 2.18483),
('1011', 'Wethaq Investment', 'IEIG', 'Wethaq M.M', 23.4454);

-- 6. UPLOADED SOURCE FILES TABLE
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status VARCHAR(30) NOT NULL DEFAULT 'PARSED' CHECK (status IN ('PROCESSING', 'PARSED', 'EXCEPTION', 'APPROVED', 'ARCHIVED'))
);

-- 7. TRANSACTIONS TABLE
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

CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON public.transactions(file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON public.transactions(symbol);

-- 8. EXCEPTIONS QUEUE TABLE
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

-- 9. GENERATED OUTPUT REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id),
    fund_id UUID NOT NULL REFERENCES public.funds(id),
    report_version VARCHAR(50) NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    storage_path TEXT NOT NULL,
    regeneration_reason TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 10. NETTING & TRANSFER SHEETS TABLE
CREATE TABLE IF NOT EXISTS public.transfer_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id),
    fund_id UUID NOT NULL REFERENCES public.funds(id),
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

-- 11. IMMUTABLE AUDIT TRAIL TABLE
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

-- IMMUTABILITY TRIGGER FOR AUDIT TRAIL
CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Trail records are strictly immutable and cannot be altered or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();
