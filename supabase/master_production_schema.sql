-- ==============================================================================
-- MASTER PRODUCTION POSTGRESQL DDL SCRIPT (100% IDEMPOTENT & SELF-CONTAINED)
-- Platform: Egyptian Mutual Fund Clearing, Netting & Trading Settlement Hub
-- 
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Create a "New query"
-- 3. Paste this entire script and click "RUN"
--
-- Features Included:
-- [1] Core Schema (14 Tables + Extensions)
-- [2] Canonical Seeds: 68 Egyptian Mutual Funds, Fund Rules & Schedules
-- [3] The 7 Institutional Operational Checklist Steps (English Titles + Arabic Descriptions)
-- [4] Auth Auto-Confirm & Profile Synchronization Triggers
-- [5] Post-Lock Immutability Trigger for Netting Batches (ACID Guard)
-- [6] Daily Shift Rollover Stored Procedure (6:00 AM Cairo Cutoff)
-- [7] Production-Grade RLS Security Lockdown (Zero Anonymous Data Wipes)
-- ==============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ROLES TABLE & CANONICAL SEEDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.roles (name, description) VALUES
('SUPER_ADMIN', 'Full system control, executive approvals, late overrides, and user provisioning'),
('OPERATIONS_USER', 'Standard operational staff executing daily trades and netting processing'),
('FINANCE_CONTROLLER', 'Financial auditor verifying bank netting sheets and ledger postings'),
('AUDITOR', 'Read-only compliance and regulatory inspection access')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- ==============================================================================
-- 2. USERS PROFILE TABLE
-- ==============================================================================
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

-- ==============================================================================
-- 3. FUNDS MASTER TABLE (68 EGYPTIAN MUTUAL FUNDS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_code VARCHAR(50) UNIQUE NOT NULL,
    fund_name VARCHAR(255) NOT NULL,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.funds (fund_code, fund_name, fund_type, status) VALUES
('1001', 'AZ - IDKHAR', 'T0', 'ACTIVE'),
('100-100', 'Beltone EGX100 Fund', 'T1', 'ACTIVE'),
('1004', 'Ataa Charity Fund', 'T0', 'ACTIVE'),
('1005', 'Al-Siola Fund-NI Capital', 'T0', 'ACTIVE'),
('1006', 'Aafaq Investment Fund', 'T1', 'ACTIVE'),
('1010', 'AZ - FORAS', 'T1', 'ACTIVE'),
('1011', 'Wethaq Investment', 'T0', 'ACTIVE'),
('1012', 'AZ - Estehkak T27 USD', 'T0', 'CLOSED'),
('1014', 'Misr Tkaful Money Market', 'T0', 'ACTIVE'),
('1015', 'CIAM Misr Equity', 'T1', 'ACTIVE'),
('1016', 'Cash Mubasher Fund', 'T0', 'ACTIVE'),
('1017', 'Istsmar w Aman', 'T1', 'ACTIVE'),
('1018', 'HORUS - AFIM', 'T0', 'ACTIVE'),
('1020', 'Misr Al Mostakbal', 'T1', 'ACTIVE'),
('1021', 'CIAM - Misr Al Youmy', 'T0', 'ACTIVE'),
('AHLAC', 'Tamayoz - AFIM', 'T0', 'ACTIVE'),
('Al Hayah', 'NBK Al-Hayah', 'T1', 'ACTIVE'),
('Almezan', 'NBK Al-Mizan', 'T1', 'ACTIVE'),
('ARUP', 'Arope Money Market', 'T0', 'CLOSED'),
('Belton USD', 'Beltone Fixed Income USD', 'T1', 'ACTIVE'),
('B-Secure', 'Beltone Fixed Income EGP', 'T0', 'ACTIVE'),
('CI MANAGEMENT', 'CI-ctor Consuming', 'T1', 'ACTIVE'),
('CIAM Building', 'CI-ctor Building', 'T1', 'ACTIVE'),
('CIAM Digital Pay', 'CI-ctor Digital Pay', 'T1', 'ACTIVE'),
('CIAM Exporting', 'CI-ctor Exporting', 'T1', 'ACTIVE'),
('CIAM Technology', 'CI-ctor Technology', 'T1', 'ACTIVE'),
('Consumer', 'Beltone Consumer Fund', 'T1', 'ACTIVE'),
('Dahab', 'Dahab - AFIM', 'T1', 'ACTIVE'),
('Delta Insurance Fund', 'Delta Life Assurance', 'T0', 'ACTIVE'),
('EGYMUBMCA', 'EGYMUBMCA', 'T0', 'ACTIVE'),
('FANAR', 'El Fanar Cash Fund', 'T0', 'ACTIVE'),
('Financial', 'Beltone Financial Fund', 'T1', 'ACTIVE'),
('GIG FUND', 'GIG Money Market', 'T0', 'ACTIVE'),
('GOLD AZ', 'AZ - Gold', 'T1', 'ACTIVE'),
('GOSOR', 'Gosour Equity Cumulativ', 'T1', 'ACTIVE'),
('Industrial', 'Beltone Industrial Fund', 'T1', 'ACTIVE'),
('Ishraq', 'NBK Money Market', 'T0', 'ACTIVE'),
('ISKAN', 'Iskan - Kol Youm', 'T1', 'ACTIVE'),
('Kenz - foras', 'Kenz Foras AAIH', 'T1', 'ACTIVE'),
('kenzshariaa', 'Kenz Shariah', 'T1', 'ACTIVE'),
('Maksab OZ', 'Maksab OZ USD', 'T1', 'ACTIVE'),
('Momentum', 'Cairo Capital Cumulative', 'T1', 'ACTIVE'),
('Mubasher Equity Fund', 'Mubasher Equity Fund', 'T1', 'ACTIVE'),
('Mubasher Gold', 'Dahab Mubasher', 'T1', 'ACTIVE'),
('NAMAA Invest', 'NBK Namaa', 'T1', 'ACTIVE'),
('ODIN IV', 'Odin Money Market', 'T0', 'ACTIVE'),
('Real-Estate', 'Beltone Real Estate Fund', 'T1', 'ACTIVE'),
('Sabayek', 'Sabayek - Belton', 'T1', 'ACTIVE'),
('Sarwaty Fund', 'Sarwaty Fund', 'T0', 'CLOSED'),
('Shariah Compliant Fund', 'CIAM - Shariah Equity', 'T1', 'ACTIVE'),
('Stream Fund', 'Cairo Capital Fixed Inc', 'T1', 'ACTIVE'),
('Target First', 'Target Fixed Income Fund', 'T0', 'ACTIVE'),
('TREND', 'Odin Equity Fund', 'T1', 'ACTIVE'),
('Wafra', 'Beltone EGX33 Shariah', 'T1', 'ACTIVE'),
('WELADNA', 'Weladna Charity fund', 'T0', 'ACTIVE'),
('Zaldi Star', 'Zaldi Money Market', 'T0', 'ACTIVE'),
('Zaldi El Masry', 'Zaldi El Masry Fund', 'T1', 'ACTIVE'),
('CI 20HD 7', 'CI 20HD 7', 'T1', 'ACTIVE'),
('CI SEC 8', 'CI SEC 8', 'T1', 'ACTIVE'),
('CI THEQUANT 6', 'CI THEQUANT 6', 'T1', 'ACTIVE'),
('Mubasher USD', 'Dollar Mubasher FI Fund', 'T0', 'ACTIVE'),
('AlShakmagya', 'Bokra Gold', 'T1', 'ACTIVE'),
('Mubasher Fadda', 'Mubasher Silver Fund', 'T1', 'ACTIVE'),
('Bareeq', 'Bareeq fund', 'T1', 'ACTIVE'),
('PFI Cashi', 'PFI Cashi fund', 'T0', 'ACTIVE'),
('Kenz EGX70', 'Kenz EGX70', 'T1', 'ACTIVE'),
('Kenz EGX 35 LV', 'Kenz EGX 35 LV', 'T1', 'ACTIVE'),
('Granite fund', 'Granite fund', 'T0', 'ACTIVE')
ON CONFLICT (fund_code) DO UPDATE SET
    fund_name = EXCLUDED.fund_name,
    fund_type = EXCLUDED.fund_type,
    status = EXCLUDED.status;

-- ==============================================================================
-- 4. FUND SETTLEMENT RULES MATRIX (T0 / T1 VISIBILITY MATRIX)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fund_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_type VARCHAR(10) NOT NULL CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    order_side VARCHAR(10) NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    is_transaction_value_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_quantity_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_rule_per_type_side UNIQUE (fund_type, order_side)
);

INSERT INTO public.fund_rules (fund_type, order_side, is_transaction_value_visible, is_quantity_visible) VALUES
('T0', 'BUY', TRUE, TRUE),
('T0', 'SELL', TRUE, TRUE),
('T1', 'BUY', TRUE, FALSE),
('T1', 'SELL', FALSE, TRUE)
ON CONFLICT (fund_type, order_side) DO UPDATE SET
    is_transaction_value_visible = EXCLUDED.is_transaction_value_visible,
    is_quantity_visible = EXCLUDED.is_quantity_visible;

-- ==============================================================================
-- 5. REFERENCE DATA & SYMBOL MAPPING REPOSITORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reference_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_code VARCHAR(50) UNIQUE NOT NULL,
    symbol_name VARCHAR(255) NOT NULL,
    actual_symbol VARCHAR(50) NOT NULL,
    email_contact VARCHAR(255),
    nav_unit_price NUMERIC(18, 5) DEFAULT 0,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    fund_id UUID REFERENCES public.funds(id),
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Core Reference Data Seed
INSERT INTO public.reference_data (symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price, fund_type) VALUES
('1006', 'Aafaq Investment Fund', 'AFAC', 'Afaq Fund', 264.2139, 'T0'),
('AHLAC', 'AHLY A. CONTRACTORS FUND', 'AHLAC', 'Tamayoz MMF', 17.3411, 'T0'),
('Al Hayah', 'Al Hayah', 'AlHayah', 'AlHayah - Hayat', 0, 'T0'),
('Almezan', 'Almezan', 'Almezan', 'Al Mizan', 0, 'T0'),
('ARUP', 'Arupe Cumulative Fund', 'AROPE', 'AROPE Insurance Misr Fund', 0, 'T0'),
('1004', 'Ataa Charity Fund', 'ATAA', 'Ataa Fund', 0, 'T0'),
('1001', 'AZ - ADKHAR', 'ADKHAR-AZ', 'ادخار / AZFI', 21.13012, 'T0'),
('1010', 'AZ - FORAS', 'Azimut Stocks', 'Azimut Equity Opportunity Fund', 52.42922, 'T1'),
('1012', 'AZ- ESTEHKAK - USD', 'STRC', 'Azimut Target Maturity - USD', 10.50541, 'T1'),
('GOLD AZ', 'AZIMUT GOLD', 'Gold AZ', 'AZ-GOLD', 25.2991, 'T0'),
('Sabayek', 'Beltone Evolve Gold Fund', 'Sabayek', 'Sabayek', 1.77656, 'T0'),
('1016', 'Cash Mubasher Fund', 'CashMubasher', 'Cash Mubasher Fund Price', 24.03852, 'T0'),
('CIAM Building', 'CIAM Building', 'CIAM Building', 'CIAM Sectors Prices - CIAM Building', 21.46952, 'T0'),
('1018', 'HORUS FUND', 'Horus', 'Horas MM', 20.89333, 'T0'),
('kenzshariaa', 'KENZSHARIAA', 'KENZSHARIAA', 'Kenz-Shareiaa - KENZSHARIAA', 181.07, 'T0'),
('1021', 'Misr Al-Youm', 'Misr Al-Youm', 'Misr Al-Youm', 19.40342, 'T0'),
('1014', 'Misr Takaful Money Market', 'Misr Takaful', 'Misr Takaful Fund', 212.05923, 'T1'),
('Mubasher Equity Fund', 'Mubasher Equity Fund', 'Mubasher Equity', 'Mubasher Equity Fund Price', 2.0182, 'T1'),
('Mubasher Gold', 'Mubasher Gold', 'Mubasher Gold', 'Dahab Mubasher - Mubasher Gold', 13.0276, 'T0'),
('1005', 'NI Capital Money Market', 'NICapital', 'SIULA fund - NI MM FUND', 24.54846, 'T1'),
('ODIN IV', 'ODIN IV', 'ODIN IV', 'ODIN MMF', 1.25639, 'T0'),
('Shariah Compliant Fund', 'Shariah Compliant Fund', 'Shariah Compliant Fund', 'Misr Shariaa Equity Price', 22.42274, 'T1'),
('100-100', 'Tharawat 100/100', 'Tharawat - 100/100', 'Beltone EGX100 - Tharawat 100/100', 2.56203, 'T1'),
('Wafra', 'Tharawat Wafra', 'Tharawat - Wafra', 'Beltone EGX33 - Tharawat Wafra', 2.18483, 'T1'),
('1011', 'Wethaq Investment', 'IEIG', 'Wethaq M.M', 23.4454, 'T1')
ON CONFLICT (symbol_code) DO UPDATE SET
    symbol_name = EXCLUDED.symbol_name,
    actual_symbol = EXCLUDED.actual_symbol,
    nav_unit_price = EXCLUDED.nav_unit_price,
    fund_type = EXCLUDED.fund_type;

-- ==============================================================================
-- 6. UPLOADED SOURCE SPREADSHEETS ARCHIVE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id),
    file_category VARCHAR(30) NOT NULL DEFAULT 'ORDERS' CHECK (file_category IN ('ORDERS', 'ALLOCATION')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'PARSED', 'EXCEPTION', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash ON public.uploaded_files(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON public.uploaded_files(uploaded_at DESC);

-- ==============================================================================
-- 7. NORMALIZED RAW TRADING TRANSACTIONS (39-COLUMN PIPELINE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    request_id VARCHAR(50) NOT NULL,
    mubasher_no VARCHAR(50),
    customer_name VARCHAR(255),
    order_side VARCHAR(10) NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    symbol VARCHAR(50) NOT NULL,
    symbol_description VARCHAR(255),
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    price NUMERIC(18, 5) NOT NULL DEFAULT 0,
    order_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_commission NUMERIC(18, 4) DEFAULT 0,
    net_settle NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cash_account_no VARCHAR(50),
    isin_code VARCHAR(50),
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_file_request UNIQUE (file_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON public.transactions(file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON public.transactions(symbol);

-- ==============================================================================
-- 8. OPERATIONAL EXCEPTION QUEUE
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_exceptions_status ON public.exceptions(status);

-- ==============================================================================
-- 9. IMMUTABLE REGULATORY AUDIT TRAIL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- 10. OPERATIONAL CHECKLISTS (THE 7 INSTITUTIONAL CANONICAL STEPS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_time VARCHAR(10) NOT NULL DEFAULT '12:00',
    priority VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by VARCHAR(255),
    completed_by_name VARCHAR(255),
    completed_at TIMESTAMP WITH TIME ZONE,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    reopened_by VARCHAR(255),
    reopened_by_name VARCHAR(255),
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopen_reason TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_checklist_code UNIQUE (checklist_code)
);

-- Seed the 7 Egyptian Mutual Fund Operational Steps (English Titles + Arabic Descriptions)
INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory, is_completed, is_approved) VALUES
('CHK-01', 'Fund Daily NAV & Valuation Price Verification', 'التحقق من أسعار وثائق صناديق الاستثمار وقيم صافي الأصول (NAV) المعلنة ومطابقتها قبل بدء تنفيذ العمليات.', '10:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-02', 'Morning T+1 Equity Orders Acceptance & Broker Routing', 'مراجعة وقبول أوامر التداول الصباحية لصناديق الأسهم (T+1) وإرسالها رسمياً لشركات السمسرة والوسطاء المنفذين.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-03', 'Pre-Market T+1 Execution Confirmation & Broker Approvals Sign-off', 'التأكد من اعتماد ومطابقة جميع أوامر T+1 المنفذة من الوسطاء واستلام إخطارات القبول والاعتماد الكاملة بدون أي رفض.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-04', 'Master Orders Dispatch to Fund Administration & Custody Services (T+0 / T+1)', 'إرسال ملف الأوامر الشامل (المهمة الرئيسية) لخدمات إدارة الصناديق وأمناء الحفظ لتسوية وتأكيد عمليات الصناديق النقدية والأسهم.', '12:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-05', 'Order Status Reconciliation: Acceptance to Final Operational Approval', 'المطابقة الرقابية لتحويل كافة أوامر التداول من حالة القبول المبدئي (Accept) إلى حالة الاعتماد النهائي (Approved) على المنظومة.', '13:00', 'HIGH', TRUE, FALSE, FALSE),
('CHK-06', 'Net Cash Settlement & Inter-Fund Bank Transfer Approval', 'مراجعة واعتماد صافي مبالغ التحويلات النقدية (Netting) بين الصناديق وحسابات البنوك واعتماد التحويلات النهائية قبل موعد الإقفال البنكي.', '13:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-07', 'End-of-Day Ledger Posting & Operational Settlement Sign-off', 'المراجعة النهائية لترحيل كافة قيود التسوية (Posting) وتأكيد الإقفال التام لليوم التشغيلي (Complete Execution Sign-off).', '14:30', 'CRITICAL', TRUE, FALSE, FALSE)
ON CONFLICT (checklist_code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    due_time = EXCLUDED.due_time,
    priority = EXCLUDED.priority,
    mandatory = EXCLUDED.mandatory;

-- ==============================================================================
-- 11. CASH NETTING BATCHES & FOUR-EYES APPROVAL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transfer_sheet_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    allocation_file_id VARCHAR(255),
    business_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'MODIFIED', 'PENDING_REVIEW', 'APPROVED', 'LOCKED')),
    total_buy_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_sell_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_net_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    maker_id VARCHAR(255),
    maker_name VARCHAR(255),
    checker_id VARCHAR(255),
    checker_name VARCHAR(255),
    rejection_reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ==============================================================================
-- 12. CASH NETTING LINES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transfer_sheet_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.transfer_sheet_batches(id) ON DELETE CASCADE,
    symbol_code VARCHAR(50) NOT NULL,
    symbol_name VARCHAR(255) NOT NULL,
    actual_symbol VARCHAR(50),
    system_buy_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    system_sell_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    system_net_amount NUMERIC(18, 4) GENERATED ALWAYS AS (system_sell_amount - system_buy_amount) STORED,
    adjustment_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    final_transfer_amount NUMERIC(18, 4) GENERATED ALWAYS AS (system_sell_amount - system_buy_amount + adjustment_amount) STORED,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_transfer_sheet_lines_batch ON public.transfer_sheet_lines(batch_id);

-- ==============================================================================
-- 13. TRANSFER LINE ADJUSTMENTS LOG (RECONCILIATION AUDIT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transfer_line_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.transfer_sheet_batches(id) ON DELETE CASCADE,
    line_id UUID NOT NULL REFERENCES public.transfer_sheet_lines(id) ON DELETE CASCADE,
    symbol_code VARCHAR(50) NOT NULL,
    system_net_snapshot NUMERIC(18, 4) NOT NULL,
    old_adjustment_amount NUMERIC(18, 4) NOT NULL,
    new_adjustment_amount NUMERIC(18, 4) NOT NULL,
    delta NUMERIC(18, 4) GENERATED ALWAYS AS (new_adjustment_amount - old_adjustment_amount) STORED,
    resulting_final_transfer NUMERIC(18, 4) NOT NULL,
    adjustment_category VARCHAR(50) NOT NULL CHECK (adjustment_category IN ('BANK_FEE', 'SETTLEMENT_DIFFERENCE', 'CUSTODIAN_CORRECTION', 'MANUAL_ADJUSTMENT', 'OTHER')),
    reason TEXT NOT NULL,
    adjusted_by UUID NOT NULL REFERENCES public.users(id),
    adjusted_by_name VARCHAR(255) NOT NULL,
    client_ip VARCHAR(45),
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ==============================================================================
-- 14. GENERATED EXCEL REPORTS METADATA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    fund_id UUID REFERENCES public.funds(id),
    report_version VARCHAR(20) NOT NULL DEFAULT 'V1.0',
    version_number INT NOT NULL DEFAULT 1,
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'reports',
    file_size_bytes BIGINT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES public.users(id)
);

-- ==============================================================================
-- 15. DATABASE TRIGGERS & BUSINESS INTEGRITY ENFORCEMENT
-- ==============================================================================

-- Trigger 1: Auto-Confirm all new Supabase Auth Users
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

-- Trigger 2: Automatic Profile Sync (auth.users -> public.users)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger 3: Post-Lock Immutability on Transfer Sheet Lines
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

-- ==============================================================================
-- 16. STORED PROCEDURES: ATOMIC WRITES & SHIFT RESET
-- ==============================================================================

-- Stored Procedure: Reset Daily Checklists (6:00 AM Cairo Shift Rollover)
CREATE OR REPLACE FUNCTION public.reset_daily_checklists()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.checklists
    SET 
        is_completed = FALSE,
        completed_by = NULL,
        completed_by_name = NULL,
        completed_at = NULL,
        is_approved = FALSE,
        approved_by = NULL,
        approved_by_name = NULL,
        approved_at = NULL,
        reopened_by = NULL,
        reopened_by_name = NULL,
        reopened_at = NULL,
        reopen_reason = NULL,
        status = 'ACTIVE';

    INSERT INTO public.audit_logs (
        id, user_name, action, entity_name, entity_id, new_values, created_at
    ) VALUES (
        uuid_generate_v4(),
        'Automated Shift Scheduler',
        'RESET_DAILY_CHECKLISTS',
        'CHECKLIST_ENGINE',
        'ALL_CHECKLISTS',
        '{"reason": "Daily operational shift rollover initialized"}'::jsonb,
        NOW()
    );
END;
$$;

-- ==============================================================================
-- 17. PRODUCTION ROW-LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy insecure anon policies (Remediates Audit Findings SEC-01 & SEC-02)
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
DROP POLICY IF EXISTS anon_audit_logs_all ON public.audit_logs;
DROP POLICY IF EXISTS anon_exceptions_all ON public.exceptions;
DROP POLICY IF EXISTS anon_transfer_batches_all ON public.transfer_sheet_batches;
DROP POLICY IF EXISTS anon_transfer_lines_all ON public.transfer_sheet_lines;

-- 3. Revoke dangerous anonymous table mutations
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 4. Safe Reference Data Read Grants (Both anon & authenticated can read system config)
GRANT SELECT ON public.roles TO anon, authenticated;
GRANT SELECT ON public.funds TO anon, authenticated;
GRANT SELECT ON public.fund_rules TO anon, authenticated;
GRANT SELECT ON public.reference_data TO anon, authenticated;

DROP POLICY IF EXISTS ref_roles_read ON public.roles;
CREATE POLICY ref_roles_read ON public.roles FOR SELECT USING (true);

DROP POLICY IF EXISTS ref_funds_read ON public.funds;
CREATE POLICY ref_funds_read ON public.funds FOR SELECT USING (true);

DROP POLICY IF EXISTS ref_rules_read ON public.fund_rules;
CREATE POLICY ref_rules_read ON public.fund_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS ref_data_read ON public.reference_data;
CREATE POLICY ref_data_read ON public.reference_data FOR SELECT USING (true);

-- 5. Operational Tables Access for Authenticated Staff
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.uploaded_files TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.exceptions TO authenticated;
GRANT ALL ON public.checklists TO authenticated;
GRANT ALL ON public.transfer_sheet_batches TO authenticated;
GRANT ALL ON public.transfer_sheet_lines TO authenticated;
GRANT ALL ON public.transfer_line_adjustments TO authenticated;
GRANT ALL ON public.generated_reports TO authenticated;

-- Audit Logs Lockdown: Append-Only (NO UPDATE, NO DELETE allowed for compliance!)
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- Grant SELECT fallback for operational views
GRANT SELECT ON public.checklists TO anon;
GRANT SELECT ON public.uploaded_files TO anon;
GRANT SELECT ON public.transfer_sheet_batches TO anon;
GRANT SELECT ON public.transfer_sheet_lines TO anon;

-- RLS Policies for Authenticated Operations
DROP POLICY IF EXISTS auth_users_access ON public.users;
CREATE POLICY auth_users_access ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_uploaded_files_access ON public.uploaded_files;
CREATE POLICY auth_uploaded_files_access ON public.uploaded_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_transactions_access ON public.transactions;
CREATE POLICY auth_transactions_access ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_exceptions_access ON public.exceptions;
CREATE POLICY auth_exceptions_access ON public.exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_checklists_access ON public.checklists;
CREATE POLICY auth_checklists_access ON public.checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_batches_access ON public.transfer_sheet_batches;
CREATE POLICY auth_batches_access ON public.transfer_sheet_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_lines_access ON public.transfer_sheet_lines;
CREATE POLICY auth_lines_access ON public.transfer_sheet_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_adjustments_access ON public.transfer_line_adjustments;
CREATE POLICY auth_adjustments_access ON public.transfer_line_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_reports_access ON public.generated_reports;
CREATE POLICY auth_reports_access ON public.generated_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_audit_read ON public.audit_logs;
CREATE POLICY auth_audit_read ON public.audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS auth_audit_insert ON public.audit_logs;
CREATE POLICY auth_audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Safe read policies for unauthenticated dashboard hydration
DROP POLICY IF EXISTS anon_checklists_read ON public.checklists;
CREATE POLICY anon_checklists_read ON public.checklists FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_uploaded_files_read ON public.uploaded_files;
CREATE POLICY anon_uploaded_files_read ON public.uploaded_files FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_batches_read ON public.transfer_sheet_batches;
CREATE POLICY anon_batches_read ON public.transfer_sheet_batches FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_lines_read ON public.transfer_sheet_lines;
CREATE POLICY anon_lines_read ON public.transfer_sheet_lines FOR SELECT TO anon USING (true);

-- 6. Sequence Grants
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- ==============================================================================
-- END OF MASTER PRODUCTION DDL SCRIPT
-- ==============================================================================
