-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 1: CORE SCHEMA (DEADLOCK-FREE)
-- AUTHORITATIVE SOURCE OF TRUTH: MUTUAL FUNDS PRICE 1.xlsx (68 FUNDS)
-- Contains: Roles, Users, 68 Funds, Rules, 68 Reference Data, 68 Fund Schedules,
--           Operations pipeline, Audit logs, and Role-based RLS policies.
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

-- 3. FUNDS MASTER TABLE (68 FUNDS FROM EXCEL)
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

ALTER TABLE public.funds DROP CONSTRAINT IF EXISTS funds_status_check;
ALTER TABLE public.funds ADD CONSTRAINT funds_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED'));

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
('GOSOR', 'Gosour Equity  Cumulativ', 'T1', 'ACTIVE'),
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
('Shariah Compliant Fund', 'CIAM -  Shariah Equity', 'T1', 'ACTIVE'),
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

-- 4. FUND SETTLEMENT RULES MATRIX TABLE
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

-- 5. REFERENCE DATA & SYMBOL MAPPINGS TABLE (68 FUNDS FROM EXCEL)
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

ALTER TABLE public.reference_data DROP CONSTRAINT IF EXISTS reference_data_status_check;
ALTER TABLE public.reference_data ADD CONSTRAINT reference_data_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CLOSED'));

INSERT INTO public.reference_data (symbol_code, symbol_name, actual_symbol, email_contact, nav_unit_price, fund_type, status) VALUES
('1001', 'AZ - IDKHAR', 'ADKHAR-AZ', 'ادخار /  AZFI', 0, 'T0', 'ACTIVE'),
('100-100', 'Beltone EGX100 Fund', 'Tharawat - 100/100', 'Beltone EGX100 - Tharawat 100/100', 0, 'T1', 'ACTIVE'),
('1004', 'Ataa Charity Fund', 'ATAA', 'Ataa Fund', 0, 'T0', 'ACTIVE'),
('1005', 'Al-Siola Fund-NI Capital', 'NICapital', 'SIULA fund - NI MM FUND', 0, 'T0', 'ACTIVE'),
('1006', 'Aafaq Investment Fund', 'AFAC', 'Afaaq Fund', 0, 'T1', 'ACTIVE'),
('1010', 'AZ - FORAS', 'Azimut Stocks', 'Azimut Equity Opportunity Fund', 0, 'T1', 'ACTIVE'),
('1011', 'Wethaq Investment', 'IEIG', 'Wethaq M.M', 0, 'T0', 'ACTIVE'),
('1012', 'AZ - Estehkak T27 USD', 'STRC', 'Azimut Target Maturity - USD', 0, 'T0', 'CLOSED'),
('1014', 'Misr Tkaful Money Market', 'Misr Takaful', 'Misr Takaful Fund', 0, 'T0', 'ACTIVE'),
('1015', 'CIAM Misr Equity', 'EQTY-', 'Misr Equity - CIAM Fund', 0, 'T1', 'ACTIVE'),
('1016', 'Cash Mubasher Fund', 'CashMubasher', 'Cash Mubasher Fund Price', 0, 'T0', 'ACTIVE'),
('1017', 'Istsmar w Aman', 'Estesmar-Aman', 'Misr Insurance  (Istithmar & Aman)', 0, 'T1', 'ACTIVE'),
('1018', 'HORUS - AFIM', 'Horus', 'Horas MM', 0, 'T0', 'ACTIVE'),
('1020', 'Misr Al Mostakbal', 'MOSTAKBAL', 'MOSTAKBAL FUND', 0, 'T1', 'ACTIVE'),
('1021', 'CIAM - Misr Al Youmy', 'Misr Al-Youm', 'Misr Al-Youm', 0, 'T0', 'ACTIVE'),
('AHLAC', 'Tamayoz - AFIM', 'AHLAC', 'Tamyouz MMF', 0, 'T0', 'ACTIVE'),
('Al Hayah', 'NBK Al-Hayah', 'AlHayah', 'AlHayah - Hayat', 0, 'T1', 'ACTIVE'),
('Almezan', 'NBK Al-Mizan', 'Almezan', 'Al Mizan', 0, 'T1', 'ACTIVE'),
('ARUP', 'Arope Money Market', 'AROPE', 'AROPE Insurance Misr Fund', 0, 'T0', 'CLOSED'),
('Belton USD', 'Beltone Fixed Income USD', 'Belton USD', 'BAM FI USD', 0, 'T1', 'ACTIVE'),
('B-Secure', 'Beltone Fixed Income EGP', 'B-Secure', 'B-Secure', 0, 'T0', 'ACTIVE'),
('CI MANAGEMENT', 'CI-ctor Consuming', 'CI MANAGEMENT', 'CIAM Sectors Prices - CI MANAGEMENT', 0, 'T1', 'ACTIVE'),
('CIAM Building', 'CI-ctor Building', 'CIAM Building', 'CIAM Sectors Prices - CIAM Building', 0, 'T1', 'ACTIVE'),
('CIAM Digital Pay', 'CI-ctor Digital Pay', 'CIAM Digital Pay', 'CIAM Sectors Prices - CIAM Digital Pay', 0, 'T1', 'ACTIVE'),
('CIAM Exporting', 'CI-ctor Exporting', 'CIAM Exporting', 'CIAM Sectors Prices - CIAM Exporting', 0, 'T1', 'ACTIVE'),
('CIAM Technology', 'CI-ctor Technology', 'CIAM Technology', 'CIAM Sectors Prices - CIAM Technology', 0, 'T1', 'ACTIVE'),
('Consumer', 'Beltone Consumer Fund', 'Tharawat - Consumer', 'Beltone Sectors Price / Tharawat – Consumer', 0, 'T1', 'ACTIVE'),
('Dahab', 'Dahab - AFIM', 'DAHAB', 'Dahab AL-Ahly', 0, 'T1', 'ACTIVE'),
('Delta Insurance Fund', 'Delta Life Assurance', 'DLTAF', 'Delta life assurance MM', 0, 'T0', 'ACTIVE'),
('EGYMUBMCA', 'EGYMUBMCA', 'EGYMUBMCA', 'Cash Mubasher Fund Price', 0, 'T0', 'ACTIVE'),
('FANAR', 'El Fanar Cash Fund', 'FANAR', 'Fanar fund', 0, 'T0', 'ACTIVE'),
('Financial', 'Beltone Financial Fund', 'Tharawat - Financial', 'Beltone Sectors Price / Tharawat – Financial', 0, 'T1', 'ACTIVE'),
('GIG FUND', 'GIG Money Market', 'GIG FUND', 'GIG MM', 0, 'T0', 'ACTIVE'),
('GOLD AZ', 'AZ - Gold', 'Gold AZ', 'AZ-GOLD', 0, 'T1', 'ACTIVE'),
('GOSOR', 'Gosour Equity  Cumulativ', 'GOSOR', 'Josour Fund', 0, 'T1', 'ACTIVE'),
('Industrial', 'Beltone Industrial Fund', 'Tharawat - industrial', 'Beltone Sectors Price / Tharawat – industrial', 0, 'T1', 'ACTIVE'),
('Ishraq', 'NBK Money Market', 'Ishraq', 'ISHRAQ', 0, 'T0', 'ACTIVE'),
('ISKAN', 'Iskan - Kol Youm', 'ISKAN FUND', 'ISKAN MM', 0, 'T1', 'ACTIVE'),
('Kenz - foras', 'Kenz Foras AAIH', 'KENZFORAS', 'Kenz 1st - Foras - KENZFORAS', 0, 'T1', 'ACTIVE'),
('kenzshariaa', 'Kenz Shariah', 'KENZSHARIAA', 'Kenz-Shareiaa - KENZSHARIAA', 0, 'T1', 'ACTIVE'),
('Maksab OZ', 'Maksab OZ USD', 'Maksab OZ', 'Maksab-OZ USD', 0, 'T1', 'ACTIVE'),
('Momentum', 'Cairo Capital Cumulative', 'Momentum', 'Cairo Capital cumulative fund- Momentum', 0, 'T1', 'ACTIVE'),
('Mubasher Equity Fund', 'Mubasher Equity Fund', 'Mubasher Equity', 'Mubasher Equity Fund Price', 0, 'T1', 'ACTIVE'),
('Mubasher Gold', 'Dahab Mubasher', 'Mubasher Gold', 'Dahab Mubasher - Mubasher Gold', 0, 'T1', 'ACTIVE'),
('NAMAA Invest', 'NBK Namaa', 'NAMAA', 'NAMAA', 0, 'T1', 'ACTIVE'),
('ODIN IV', 'Odin Money Market', 'ODIN IV', 'ODIN MMF', 0, 'T0', 'ACTIVE'),
('Real-Estate', 'Beltone Real Estate Fund', 'Tharawat - Real estate', 'Beltone Sectors Price / Tharawat – Real estate', 0, 'T1', 'ACTIVE'),
('Sabayek', 'Sabayek - Belton', 'Sabayek', 'Sabayek', 0, 'T1', 'ACTIVE'),
('Sarwaty Fund', 'Sarwaty Fund', 'Sarwaty Fund', 'Sarwaty Fund', 0, 'T0', 'CLOSED'),
('Shariah Compliant Fund', 'CIAM -  Shariah Equity', 'Shariah Compliant Fund', 'Misr Shariaa Equity Price', 0, 'T1', 'ACTIVE'),
('Stream Fund', 'Cairo Capital Fixed Inc', 'Stream', 'Cairo Capital Fixed income – Stream Fund', 0, 'T1', 'ACTIVE'),
('Target First', 'Target Fixed Income Fund', 'Target First', 'Target MM  -Target First', 0, 'T0', 'ACTIVE'),
('TREND', 'Odin Equity Fund', 'TREND', 'Trend Fund', 0, 'T1', 'ACTIVE'),
('Wafra', 'Beltone EGX33 Shariah', 'Tharawat - Wafra', 'Beltone EGX33 - Tharawat Wafra', 0, 'T1', 'ACTIVE'),
('WELADNA', 'Weladna Charity fund', 'WELADNA', 'Weladna', 0, 'T0', 'ACTIVE'),
('Zaldi Star', 'Zaldi Money Market', 'Zaldi Star', 'Zaldi Star MMF', 0, 'T0', 'ACTIVE'),
('Zaldi El Masry', 'Zaldi El Masry Fund', 'ZALDI-MSRY', 'Zaldi El Masry Fund PRICE', 0, 'T1', 'ACTIVE'),
('CI 20HD 7', 'CI 20HD 7', 'CI 20HD 7', 'CIAM Sectors Prices - CIAM 7 Issue - 20HD', 0, 'T1', 'ACTIVE'),
('CI SEC 8', 'CI SEC 8', 'CI Sec 8', 'CIAM Sectors Prices - CIAM 8 Issue - IPO', 0, 'T1', 'ACTIVE'),
('CI THEQUANT 6', 'CI THEQUANT 6', 'CI TheQuant 6', 'CIAM Sectors Prices - CIAM 6 Issue - The Quant', 0, 'T1', 'ACTIVE'),
('Mubasher USD', 'Dollar Mubasher FI Fund', 'Dollar Mubasher', 'Dollar Mubasher Investment Fund Price', 0, 'T0', 'ACTIVE'),
('AlShakmagya', 'Bokra Gold', 'AlShakmagya', 'Bokra Gold fund (Shakmajiya)', 0, 'T1', 'ACTIVE'),
('Mubasher Fadda', 'Mubasher Silver Fund', 'Fadda Mubasher', 'Mubsher Silver price', 0, 'T1', 'ACTIVE'),
('Bareeq', 'Bareeq fund', 'Bareeq', 'Bariq fund price', 0, 'T1', 'ACTIVE'),
('PFI Cashi', 'PFI Cashi fund', 'PFI Cashi', 'PFI Cashi', 0, 'T0', 'ACTIVE'),
('Kenz EGX70', 'Kenz EGX70', 'Kenz EGX70', 'Kenz EGX70', 0, 'T1', 'ACTIVE'),
('Kenz EGX 35 LV', 'Kenz EGX 35 LV', 'Kenz EGX 35 LV', 'Kenz EGX 35 LV', 0, 'T1', 'ACTIVE'),
('Granite fund', 'Granite fund', 'Granite fund', 'Granite fund price', 0, 'T0', 'ACTIVE')
ON CONFLICT (symbol_code) DO UPDATE SET
    symbol_name = EXCLUDED.symbol_name,
    actual_symbol = EXCLUDED.actual_symbol,
    fund_type = EXCLUDED.fund_type,
    email_contact = EXCLUDED.email_contact,
    status = EXCLUDED.status;

-- 6. FUND SCHEDULES TABLE (68 PARSED OPERATIONAL SCHEDULES)
DROP TABLE IF EXISTS public.fund_schedules CASCADE;
CREATE TABLE public.fund_schedules (
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

INSERT INTO public.fund_schedules (fund_code, fund_type, frequency, buy_days, sell_days, notice_lead_day, notice_cutoff_time, raw_instruction, status) VALUES
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
('WELADNA', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'خيري', 'ACTIVE'),
('Zaldi Star', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
('Zaldi El Masry', 'T1', 'WEEKLY', '["SUN"]'::jsonb, '["SUN"]'::jsonb, 'WEDNESDAY', '14:00', 'اسبوعي بيتم ارسال اخطار الاربعاء الساعه 2 وبيتم التنفيذ الاحد', 'ACTIVE'),
('CI 20HD 7', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('CI SEC 8', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('CI THEQUANT 6', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('Mubasher USD', 'T0', 'WEEKLY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["MON"]'::jsonb, 'NONE', '12:00', 'الشراء t+0&البيع اسبوعي يوم الاثنين', 'ACTIVE'),
('AlShakmagya', 'T1', 'CUSTOM', '["MON","TUE","WED","THU"]'::jsonb, '["MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'من الاثنين للخميس T+1', 'ACTIVE'),
('Mubasher Fadda', 'T1', 'CUSTOM', '["MON","TUE","WED","THU"]'::jsonb, '["MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'من الاثنين للخميس T+1', 'ACTIVE'),
('Bareeq', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('PFI Cashi', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE'),
('Kenz EGX70', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('Kenz EGX 35 LV', 'T1', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 'T+1', 'ACTIVE'),
('Granite fund', 'T0', 'DAILY', '["SUN","MON","TUE","WED","THU"]'::jsonb, '["SUN","MON","TUE","WED","THU"]'::jsonb, 'NONE', '12:00', 't+0', 'ACTIVE');

-- 7. UPLOADED FILES AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id),
    file_category VARCHAR(30) NOT NULL DEFAULT 'ORDERS',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING'
);

-- 8. NORMALIZED RAW TRANSACTIONS TABLE
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

-- 9. EXCEPTIONS QUEUE TABLE
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

-- 10. IMMUTABLE AUDIT TRAIL TABLE
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

-- 11. DYNAMIC CHECKLISTS TABLE
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
    reopened_by VARCHAR(255),
    reopened_by_name VARCHAR(255),
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopen_reason TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory) VALUES
('CHK-01', 'Daily Allocation File Upload & Verification', 'Upload and verify 39-column allocation file.', '09:30', 'CRITICAL', TRUE),
('CHK-02', 'T0 / T1 Fund Settlement Review', 'Review generated calculations based on Allocated Qty x Price.', '11:00', 'HIGH', TRUE),
('CHK-03', 'Transfer Sheet Maker Sign-off', 'Review System Net Transfer and enter manual adjustments.', '13:00', 'CRITICAL', TRUE),
('CHK-04', 'Checker 4-Eyes Review & Approval', 'Approve and lock final transfer settlement sheet.', '15:00', 'CRITICAL', TRUE)
ON CONFLICT DO NOTHING;

-- 12. TRANSFER SHEET BATCHES (ALLOCATION PIPELINE)
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

-- 13. TRANSFER SHEET LINES
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
    adjustment_category VARCHAR(50),
    adjustment_reason TEXT,
    final_transfer_amount NUMERIC(18, 4) GENERATED ALWAYS AS ((system_sell_amount - system_buy_amount) + adjustment_amount) STORED,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 14. TRANSFER LINE ADJUSTMENTS (AUDIT TRAIL FOR ADJUSTMENTS)
CREATE TABLE IF NOT EXISTS public.transfer_line_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.transfer_sheet_batches(id) ON DELETE CASCADE,
    line_id UUID NOT NULL REFERENCES public.transfer_sheet_lines(id) ON DELETE CASCADE,
    symbol_code VARCHAR(50) NOT NULL,
    system_net_snapshot NUMERIC(18, 4) NOT NULL,
    old_adjustment_amount NUMERIC(18, 4) NOT NULL,
    new_adjustment_amount NUMERIC(18, 4) NOT NULL,
    delta NUMERIC(18, 4) NOT NULL,
    resulting_final_transfer NUMERIC(18, 4) NOT NULL,
    adjustment_category VARCHAR(50) NOT NULL CHECK (adjustment_category IN ('BANK_FEE', 'SETTLEMENT_DIFFERENCE', 'CUSTODIAN_CORRECTION', 'MANUAL_ADJUSTMENT', 'OTHER')),
    reason TEXT NOT NULL CHECK (length(reason) >= 10),
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    client_ip VARCHAR(45) NOT NULL,
    timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
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

-- Read policies (allow full read access across tables)
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'roles', 'users', 'funds', 'fund_rules', 'reference_data',
        'uploaded_files', 'transactions', 'exceptions', 'audit_logs',
        'checklists', 'transfer_sheet_batches', 'transfer_sheet_lines',
        'transfer_line_adjustments', 'fund_schedules'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS rls_read_%I ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY rls_read_%I ON public.%I FOR SELECT USING (true);', tbl, tbl);
    END LOOP;
END $$;

-- Write policies (allow full access for server actions and authenticated users)
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'roles', 'users', 'funds', 'reference_data', 'uploaded_files', 'transactions',
        'exceptions', 'audit_logs', 'checklists', 'transfer_sheet_batches',
        'transfer_sheet_lines', 'transfer_line_adjustments', 'fund_schedules'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS rls_write_%I ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY rls_write_%I ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;
