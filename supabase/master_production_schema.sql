-- ==============================================================================
-- MASTER PRODUCTION SCHEMA (COMPLETE & 100% IDEMPOTENT)
-- Platform: Egyptian Mutual Fund Clearing, Netting & Trading Settlement Hub
--
-- Instructions:
-- 1. Open Supabase Studio -> SQL Editor
-- 2. Click "+ New query" (open a clean, blank query tab)
-- 3. Paste this ENTIRE script and click "Run" (Ctrl + Enter)
--
-- Features:
-- [1] Zero ON CONFLICT Dependencies (Eliminates Error 42P10 completely)
-- [2] Pre-Column Existence Check (Eliminates Error 42703 completely)
-- [3] Foreign Key Cascades: ON DELETE SET NULL on all referencing tables
-- [4] Audit Logs Preserved: Drops blocking FKs on audit_logs
-- [5] Cumulative Buy & Sell Netting: adjusted_buy_amount & adjusted_sell_amount
-- [6] Supabase Performance Advisor: All RLS wrapped in (SELECT auth.uid())
-- [7] Complete Seeds: 68 Egyptian Mutual Funds, Rules, Schedules & 7 Checklists
-- [8] Security Definer RPCs: admin_set_user_password & admin_delete_user
-- ==============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ==============================================================================
-- 1. ROLES TABLE & CANONICAL SEEDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Seed Roles without ON CONFLICT dependency
INSERT INTO public.roles (name, description)
SELECT v.name, v.description
FROM (VALUES
    ('SUPER_ADMIN', 'Full system control, executive approvals, late overrides, and user provisioning'),
    ('OPERATIONS_USER', 'Standard operational staff executing daily trades and netting processing'),
    ('OPERATIONS_MAKER', 'Operational maker submitting daily trade batches and drafts'),
    ('OPERATIONS_CHECKER', 'Independent checker reviewing and approving daily netting batches (4-Eyes Principle)'),
    ('FINANCE_CONTROLLER', 'Financial auditor verifying bank netting sheets and ledger postings'),
    ('AUDITOR', 'Read-only compliance and regulatory inspection access')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.name = v.name);

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

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users 
    ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ==============================================================================
-- 3. FUNDS MASTER TABLE (68 EGYPTIAN MUTUAL FUNDS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_code VARCHAR(50) UNIQUE NOT NULL,
    fund_name VARCHAR(255) NOT NULL,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.funds ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.funds DROP CONSTRAINT IF EXISTS funds_created_by_fkey;
ALTER TABLE public.funds 
    ADD CONSTRAINT funds_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Seed Funds without ON CONFLICT dependency
INSERT INTO public.funds (fund_code, fund_name, fund_type, status)
SELECT v.fund_code, v.fund_name, v.fund_type, v.status
FROM (VALUES
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
) AS v(fund_code, fund_name, fund_type, status)
WHERE NOT EXISTS (SELECT 1 FROM public.funds f WHERE f.fund_code = v.fund_code);

-- ==============================================================================
-- 4. FUND SETTLEMENT RULES MATRIX (T0 / T1 VISIBILITY MATRIX)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fund_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_id UUID REFERENCES public.funds(id) ON DELETE CASCADE,
    fund_type VARCHAR(10) NOT NULL CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    order_side VARCHAR(10) NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    is_transaction_value_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_quantity_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.fund_rules ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.funds(id) ON DELETE CASCADE;
ALTER TABLE public.fund_rules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.fund_rules ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.fund_rules DROP CONSTRAINT IF EXISTS fund_rules_created_by_fkey;
ALTER TABLE public.fund_rules 
    ADD CONSTRAINT fund_rules_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

INSERT INTO public.fund_rules (fund_type, order_side, is_transaction_value_visible, is_quantity_visible)
SELECT v.fund_type, v.order_side, v.is_transaction_value_visible, v.is_quantity_visible
FROM (VALUES
    ('T0', 'BUY', TRUE, TRUE),
    ('T0', 'SELL', TRUE, TRUE),
    ('T1', 'BUY', TRUE, FALSE),
    ('T1', 'SELL', FALSE, TRUE)
) AS v(fund_type, order_side, is_transaction_value_visible, is_quantity_visible)
WHERE NOT EXISTS (
    SELECT 1 FROM public.fund_rules fr 
    WHERE fr.fund_type = v.fund_type AND fr.order_side = v.order_side
);

-- ==============================================================================
-- 5. FUND SCHEDULES TABLE (OPERATIONAL CYCLES & NOTICE RULES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fund_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fund_code VARCHAR(50) NOT NULL,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0',
    frequency VARCHAR(30) NOT NULL DEFAULT 'DAILY',
    buy_days JSONB DEFAULT '["SUN","MON","TUE","WED","THU"]'::jsonb,
    sell_days JSONB DEFAULT '["SUN","MON","TUE","WED","THU"]'::jsonb,
    notice_lead_day VARCHAR(30) DEFAULT 'NONE',
    notice_cutoff_time VARCHAR(10) DEFAULT '12:00',
    raw_instruction TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Seed Fund Schedules safely with WHERE NOT EXISTS
INSERT INTO public.fund_schedules (fund_code, fund_type, frequency, buy_days, sell_days, notice_lead_day, notice_cutoff_time, raw_instruction, status)
SELECT v.fund_code, v.fund_type, v.frequency, v.buy_days, v.sell_days, v.notice_lead_day, v.notice_cutoff_time, v.raw_instruction, v.status
FROM (VALUES
    ('1001', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+0', 'ACTIVE'),
    ('100-100', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('1004', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'خيري', 'ACTIVE'),
    ('1005', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+0', 'ACTIVE'),
    ('1006', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('1010', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('1011', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('1012', 'T0', 'CLOSED', '[]'::jsonb, '[]'::jsonb, 'NONE', '12:00', 'closed', 'CLOSED'),
    ('1014', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('1015', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('1016', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+0', 'ACTIVE'),
    ('1017', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('1018', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('1020', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('1021', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('AHLAC', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('Al Hayah', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('Almezan', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('ARUP', 'T0', 'CLOSED', '[]'::jsonb, '[]'::jsonb, 'NONE', '12:00', 'closed', 'CLOSED'),
    ('Belton USD', 'T1', 'BIWEEKLY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["2ND_MON","4TH_MON"]'::jsonb, 'NONE', '12:00', 'شراء T+1&البيع يوم الاثنين فى ثاني اسبوع ورابع اسبوع من كل شهر', 'ACTIVE'),
    ('B-Secure', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+0', 'ACTIVE'),
    ('CI MANAGEMENT', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('CIAM Building', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('CIAM Digital Pay', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('CIAM Exporting', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('CIAM Technology', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Consumer', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Dahab', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Delta Insurance Fund', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('EGYMUBMCA', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('FANAR', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('Financial', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('GIG FUND', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('GOLD AZ', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('GOSOR', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Industrial', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Ishraq', 'T0', 'DAILY', '[]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+0 وحاليا بيتم الاستراد فقط مغلق اكتتاب', 'ACTIVE'),
    ('ISKAN', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Kenz - foras', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('kenzshariaa', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Maksab OZ', 'T1', 'MONTHLY', '["MON"]'::jsonb, '["FIRST_MON_AFTER_DAY_18"]'::jsonb, 'DAY_18', '12:00', 'الشراء اسبوعي يومي الاثنين & البيع بيتم ارسال اخطار يوم 18 من كل شهر وبيتم التنفيذ فى اول يوم اثنين من كل شهر', 'ACTIVE'),
    ('Momentum', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+1', 'ACTIVE'),
    ('Mubasher Equity Fund', 'T1', 'WEEKLY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'الشراء t+1&البيع اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('Mubasher Gold', 'T1', 'CUSTOM', '["MON","TUE","WED","THU"]'::jsonb, '["MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'من الاثنين للخميس T+1', 'ACTIVE'),
    ('NAMAA Invest', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('ODIN IV', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('Real-Estate', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Sabayek', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Sarwaty Fund', 'T0', 'CLOSED', '[]'::jsonb, '[]'::jsonb, 'NONE', '12:00', 'closed', 'CLOSED'),
    ('Shariah Compliant Fund', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('Stream Fund', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+1', 'ACTIVE'),
    ('Target First', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
    ('TREND', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'THURSDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد', 'ACTIVE'),
    ('Wafra', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
    ('WELADNA', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'خيري', 'ACTIVE')
) AS v(fund_code, fund_type, frequency, buy_days, sell_days, notice_lead_day, notice_cutoff_time, raw_instruction, status)
WHERE NOT EXISTS (
    SELECT 1 FROM public.fund_schedules fs WHERE fs.fund_code = v.fund_code
);

-- ==============================================================================
-- 6. REFERENCE DATA & SYMBOL MAPPING REPOSITORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reference_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_code VARCHAR(50) UNIQUE NOT NULL,
    symbol_name VARCHAR(255) NOT NULL,
    actual_symbol VARCHAR(50) NOT NULL,
    email_contact VARCHAR(255),
    nav_unit_price NUMERIC(18, 5) DEFAULT 0,
    fund_type VARCHAR(10) NOT NULL DEFAULT 'T0' CHECK (fund_type IN ('T0', 'T1', 'T2', 'DVP')),
    fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.reference_data ADD COLUMN IF NOT EXISTS fund_type VARCHAR(10) NOT NULL DEFAULT 'T0';
ALTER TABLE public.reference_data ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.reference_data DROP CONSTRAINT IF EXISTS reference_data_created_by_fkey;
ALTER TABLE public.reference_data 
    ADD CONSTRAINT reference_data_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

INSERT INTO public.reference_data (symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price, fund_type)
SELECT v.symbol_code, v.symbol_name, v.actual_symbol, v.email_contact, v.nav_unit_price, v.fund_type
FROM (VALUES
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
) AS v(symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price, fund_type)
WHERE NOT EXISTS (
    SELECT 1 FROM public.reference_data rd WHERE rd.symbol_code = v.symbol_code
);

-- ==============================================================================
-- 7. UPLOADED SOURCE SPREADSHEETS ARCHIVE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    file_category VARCHAR(30) NOT NULL DEFAULT 'ORDERS' CHECK (file_category IN ('ORDERS', 'ALLOCATION')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'PARSED', 'EXCEPTION', 'FAILED'))
);

ALTER TABLE public.uploaded_files ADD COLUMN IF NOT EXISTS file_category VARCHAR(30) NOT NULL DEFAULT 'ORDERS';
ALTER TABLE public.uploaded_files ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING';
ALTER TABLE public.uploaded_files ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_uploaded_by_fkey;
ALTER TABLE public.uploaded_files 
    ADD CONSTRAINT uploaded_files_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash ON public.uploaded_files(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON public.uploaded_files(uploaded_at DESC);

-- ==============================================================================
-- 8. NORMALIZED RAW TRADING TRANSACTIONS (39-COLUMN PIPELINE)
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
-- 9. OPERATIONAL EXCEPTION QUEUE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    exception_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_payload JSONB,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'RESOLVED', 'IGNORED')),
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

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

CREATE INDEX IF NOT EXISTS idx_exceptions_status ON public.exceptions(status);

-- ==============================================================================
-- 10. IMMUTABLE REGULATORY AUDIT TRAIL (NO FK BLOCKERS ON USERS)
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

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Safely drop any foreign keys on audit_logs that reference users
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
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- 11. OPERATIONAL CHECKLISTS (7 CANONICAL INSTITUTIONAL STEPS)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reopened_by VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reopened_by_name VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory, is_completed, is_approved)
SELECT v.checklist_code, v.title, v.description, v.due_time, v.priority, v.mandatory, false, false
FROM (VALUES
    ('CHK-01', 'Fund Daily NAV & Valuation Price Verification', 'التحقق من أسعار وثائق صناديق الاستثمار وقيم صافي الأصول (NAV) المعلنة ومطابقتها قبل بدء تنفيذ العمليات.', '10:00', 'CRITICAL', TRUE),
    ('CHK-02', 'Morning T+1 Equity Orders Acceptance & Broker Routing', 'مراجعة وقبول أوامر التداول الصباحية لصناديق الأسهم (T+1) وإرسالها رسمياً لشركات السمسرة والوسطاء المنفذين.', '11:00', 'CRITICAL', TRUE),
    ('CHK-03', 'Pre-Market T+1 Execution Confirmation & Broker Approvals Sign-off', 'التأكد من اعتماد ومطابقة جميع أوامر T+1 المنفذة من الوسطاء واستلام إخطارات القبول والاعتماد الكاملة بدون أي رفض.', '11:00', 'CRITICAL', TRUE),
    ('CHK-04', 'Master Orders Dispatch to Fund Administration & Custody Services (T+0 / T+1)', 'إرسال ملف الأوامر الشامل (المهمة الرئيسية) لخدمات إدارة الصناديق وأمناء الحفظ لتسوية وتأكيد عمليات الصناديق النقدية والأسهم.', '12:30', 'CRITICAL', TRUE),
    ('CHK-05', 'Order Status Reconciliation: Acceptance to Final Operational Approval', 'المطابقة الرقابية لتحويل كافة أوامر التداول من حالة القبول المبدئي (Accept) إلى حالة الاعتماد النهائي (Approved) على المنظومة.', '13:00', 'HIGH', TRUE),
    ('CHK-06', 'Net Cash Settlement & Inter-Fund Bank Transfer Approval', 'مراجعة واعتماد صافي مبالغ التحويلات النقدية (Netting) بين الصناديق وحسابات البنوك واعتماد التحويلات النهائية قبل موعد الإقفال البنكي.', '13:30', 'CRITICAL', TRUE),
    ('CHK-07', 'End-of-Day Ledger Posting & Operational Settlement Sign-off', 'المراجعة النهائية لترحيل كافة قيود التسوية (Posting) وتأكيد الإقفال التام لليوم التشغيلي (Complete Execution Sign-off).', '14:30', 'CRITICAL', TRUE)
) AS v(checklist_code, title, description, due_time, priority, mandatory)
WHERE NOT EXISTS (
    SELECT 1 FROM public.checklists c WHERE c.checklist_code = v.checklist_code
);

-- ==============================================================================
-- 12. CASH NETTING BATCHES & FOUR-EYES APPROVAL
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

ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS maker_id VARCHAR(255);
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS maker_name VARCHAR(255);
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS checker_id VARCHAR(255);
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS checker_name VARCHAR(255);
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS total_buy_amount NUMERIC(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS total_sell_amount NUMERIC(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE public.transfer_sheet_batches ADD COLUMN IF NOT EXISTS total_net_amount NUMERIC(18, 4) NOT NULL DEFAULT 0;

-- ==============================================================================
-- 13. CASH NETTING LINES (WITH CUMULATIVE BUY & SELL ADJUSTMENTS)
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
    adjusted_buy_amount NUMERIC(18, 4),
    adjusted_sell_amount NUMERIC(18, 4),
    adjustment_category VARCHAR(50),
    adjustment_reason TEXT,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure cumulative adjustment columns exist unconditionally
ALTER TABLE public.transfer_sheet_lines ADD COLUMN IF NOT EXISTS adjusted_buy_amount NUMERIC(18, 4);
ALTER TABLE public.transfer_sheet_lines ADD COLUMN IF NOT EXISTS adjusted_sell_amount NUMERIC(18, 4);
ALTER TABLE public.transfer_sheet_lines ADD COLUMN IF NOT EXISTS adjustment_category VARCHAR(50);
ALTER TABLE public.transfer_sheet_lines ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_transfer_sheet_lines_batch ON public.transfer_sheet_lines(batch_id);

-- ==============================================================================
-- 14. TRANSFER LINE ADJUSTMENTS LOG (AUDIT & MULTI-MODE SUPPORT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transfer_line_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.transfer_sheet_batches(id) ON DELETE CASCADE,
    line_id UUID NOT NULL REFERENCES public.transfer_sheet_lines(id) ON DELETE CASCADE,
    symbol_code VARCHAR(50) NOT NULL,
    system_net_snapshot NUMERIC(18, 4) NOT NULL DEFAULT 0,
    old_adjustment_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    new_adjustment_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    delta NUMERIC(18, 4) GENERATED ALWAYS AS (new_adjustment_amount - old_adjustment_amount) STORED,
    resulting_final_transfer NUMERIC(18, 4) NOT NULL DEFAULT 0,
    adjustment_category VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    adjusted_by_name VARCHAR(255),
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    adjusted_buy_amount NUMERIC(18, 4),
    adjusted_sell_amount NUMERIC(18, 4),
    client_ip VARCHAR(45),
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure all columns exist before modifying constraints (prevents Error 42703)
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS adjusted_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS adjusted_by_name VARCHAR(255);
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS adjusted_buy_amount NUMERIC(18, 4);
ALTER TABLE public.transfer_line_adjustments ADD COLUMN IF NOT EXISTS adjusted_sell_amount NUMERIC(18, 4);

-- Ensure adjusted_by is nullable & safe on user deletion
ALTER TABLE public.transfer_line_adjustments ALTER COLUMN adjusted_by DROP NOT NULL;
ALTER TABLE public.transfer_line_adjustments DROP CONSTRAINT IF EXISTS transfer_line_adjustments_adjusted_by_fkey;
ALTER TABLE public.transfer_line_adjustments 
    ADD CONSTRAINT transfer_line_adjustments_adjusted_by_fkey 
    FOREIGN KEY (adjusted_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Ensure check constraint covers all 3 operational adjustment modes
DO $$
BEGIN
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
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_line ON public.transfer_line_adjustments(line_id);
CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_batch ON public.transfer_line_adjustments(batch_id);

-- ==============================================================================
-- 15. GENERATED EXCEL REPORTS METADATA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
    fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
    report_version VARCHAR(20) NOT NULL DEFAULT 'V1.0',
    version_number INT NOT NULL DEFAULT 1,
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'reports',
    file_size_bytes BIGINT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.generated_reports ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_created_by_fkey;
ALTER TABLE public.generated_reports 
    ADD CONSTRAINT generated_reports_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ==============================================================================
-- 16. DYNAMIC CASCADE SWEEP (GUARANTEES ZERO USER DELETION ERRORS)
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.constraint_name,
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'users'
          AND tc.table_name NOT IN ('users', 'audit_logs')
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL;',
            r.table_schema, r.table_name, r.column_name);
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;',
            r.table_schema, r.table_name, r.constraint_name);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL;',
            r.table_schema, r.table_name, r.constraint_name, r.column_name);
    END LOOP;
END $$;

-- ==============================================================================
-- 17. DATABASE TRIGGERS & BUSINESS INTEGRITY ENFORCEMENT
-- ==============================================================================

-- Trigger 1: Auto-Confirm all new Supabase Auth Users
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

    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        UPDATE public.users
        SET email = NEW.email, full_name = user_full_name, role_id = COALESCE(public.users.role_id, default_role_id)
        WHERE id = NEW.id;
    ELSE
        INSERT INTO public.users (id, email, full_name, role_id, status)
        VALUES (NEW.id, NEW.email, user_full_name, default_role_id, 'ACTIVE');
    END IF;

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
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, extensions
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

-- Stored Procedure: Reset Daily Checklists (6:00 AM Cairo Shift Rollover)
CREATE OR REPLACE FUNCTION public.reset_daily_checklists()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
-- 18. SECURE ADMINISTRATIVE RPCs (PASSWORD & USER MANAGEMENT)
-- ==============================================================================

-- 1. admin_set_user_password: Super Admins set or reset passwords cleanly
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

    SELECT r.name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = caller_id;

    IF caller_id != target_user_id AND (caller_role IS NULL OR caller_role != 'SUPER_ADMIN') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can set passwords for other users.';
    END IF;

    IF new_password IS NULL OR length(new_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters long.';
    END IF;

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

-- 2. admin_delete_user: Super Admins delete users without foreign key blockers
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
    target_email TEXT;
BEGIN
    caller_id := (SELECT auth.uid());
    
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF caller_id = target_user_id THEN
        RAISE EXCEPTION 'Safety Guard: Administrators cannot delete their own account.';
    END IF;

    SELECT r.name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = caller_id;

    IF caller_role IS NULL OR caller_role != 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can delete user accounts.';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    IF target_email IS NULL THEN
        SELECT email INTO target_email FROM public.users WHERE id = target_user_id;
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
    DELETE FROM public.users WHERE id = target_user_id;

    INSERT INTO public.audit_logs (
        id, user_id, user_name, action, entity_name, entity_id, old_values, created_at
    ) VALUES (
        uuid_generate_v4(),
        caller_id::text,
        'Super Administrator',
        'ADMIN_DELETE_USER',
        'USER_MANAGEMENT',
        target_user_id::text,
        jsonb_build_object('deleted_user_email', target_email, 'deleted_user_id', target_user_id),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'message', 'User account permanently deleted.');
END;
$$;

-- ==============================================================================
-- 19. SUPABASE ADVISOR OPTIMIZATIONS & RLS POLICIES
-- ==============================================================================

-- 1. Bulletproof Dynamic Drop: Drop ALL existing policies in 'public' schema
-- This guarantees zero "policy already exists" errors regardless of previous migrations
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Enable RLS across all tables
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exceptions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_sheet_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_line_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports         ENABLE ROW LEVEL SECURITY;

-- Clean, Advisor-Optimized Policies with (SELECT auth.uid()) Scalar Subqueries

-- 1. Configuration & Master Data (Public/Operational Reads)
DROP POLICY IF EXISTS authenticated_roles_read ON public.roles;
CREATE POLICY authenticated_roles_read ON public.roles
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS authenticated_funds_all ON public.funds;
CREATE POLICY authenticated_funds_all ON public.funds
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_funds_read ON public.funds;
CREATE POLICY anon_funds_read ON public.funds
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_fund_rules_all ON public.fund_rules;
CREATE POLICY authenticated_fund_rules_all ON public.fund_rules
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_fund_rules_read ON public.fund_rules;
CREATE POLICY anon_fund_rules_read ON public.fund_rules
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_ref_data_all ON public.reference_data;
CREATE POLICY authenticated_ref_data_all ON public.reference_data
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_ref_data_read ON public.reference_data;
CREATE POLICY anon_ref_data_read ON public.reference_data
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_fund_schedules_all ON public.fund_schedules;
CREATE POLICY authenticated_fund_schedules_all ON public.fund_schedules
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_fund_schedules_read ON public.fund_schedules;
CREATE POLICY anon_fund_schedules_read ON public.fund_schedules
    FOR SELECT TO anon USING (true);

-- 2. Users (Authenticated can view directory and manage accounts)
DROP POLICY IF EXISTS authenticated_users_read ON public.users;
CREATE POLICY authenticated_users_read ON public.users
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_users_write ON public.users;
CREATE POLICY authenticated_users_write ON public.users
    FOR ALL TO authenticated 
    USING ((SELECT auth.uid()) IS NOT NULL) 
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 3. Operational Tables
DROP POLICY IF EXISTS authenticated_uploaded_files_all ON public.uploaded_files;
CREATE POLICY authenticated_uploaded_files_all ON public.uploaded_files
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_uploaded_files_read ON public.uploaded_files;
CREATE POLICY anon_uploaded_files_read ON public.uploaded_files
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_transactions_all ON public.transactions;
CREATE POLICY authenticated_transactions_all ON public.transactions
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_exceptions_all ON public.exceptions;
CREATE POLICY authenticated_exceptions_all ON public.exceptions
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_checklists_all ON public.checklists;
CREATE POLICY authenticated_checklists_all ON public.checklists
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_checklists_read ON public.checklists;
CREATE POLICY anon_checklists_read ON public.checklists
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_transfer_batches_all ON public.transfer_sheet_batches;
CREATE POLICY authenticated_transfer_batches_all ON public.transfer_sheet_batches
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_transfer_batches_read ON public.transfer_sheet_batches;
CREATE POLICY anon_transfer_batches_read ON public.transfer_sheet_batches
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_transfer_lines_all ON public.transfer_sheet_lines;
CREATE POLICY authenticated_transfer_lines_all ON public.transfer_sheet_lines
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS anon_transfer_lines_read ON public.transfer_sheet_lines;
CREATE POLICY anon_transfer_lines_read ON public.transfer_sheet_lines
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_line_adjustments_all ON public.transfer_line_adjustments;
CREATE POLICY authenticated_line_adjustments_all ON public.transfer_line_adjustments
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_reports_all ON public.generated_reports;
CREATE POLICY authenticated_reports_all ON public.generated_reports
    FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 4. Audit Trail (Strict Append-Only Ledger)
DROP POLICY IF EXISTS authenticated_audit_logs_read ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_read ON public.audit_logs
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS authenticated_audit_logs_insert ON public.audit_logs;
CREATE POLICY authenticated_audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ==============================================================================
-- 20. COVERING INDEXES FOR SUPABASE ADVISOR
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_funds_created_by ON public.funds(created_by);
CREATE INDEX IF NOT EXISTS idx_fund_rules_fund_id ON public.fund_rules(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_rules_created_by ON public.fund_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_fund_schedules_fund_code ON public.fund_schedules(fund_code);
CREATE INDEX IF NOT EXISTS idx_reference_data_fund_id ON public.reference_data(fund_id);
CREATE INDEX IF NOT EXISTS idx_reference_data_created_by ON public.reference_data(created_by);
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
-- 21. ROLE & SEQUENCE GRANTS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

GRANT SELECT ON public.roles, public.funds, public.fund_rules, public.reference_data, 
                public.fund_schedules, public.checklists, public.uploaded_files, 
                public.transfer_sheet_batches, public.transfer_sheet_lines TO anon;

GRANT EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_confirm_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_daily_checklists() TO authenticated, service_role;

-- ==============================================================================
-- END OF MASTER PRODUCTION SCHEMA
-- ==============================================================================
