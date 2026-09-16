-- ==============================================================================
-- 09_TRANSFER_LINE_BUY_SELL_ADJUSTMENTS.SQL
-- PRODUCTION MIGRATION: CUMULATIVE BUY & SELL ADJUSTMENT PERSISTENCE
--
-- Enables interrelated, cumulative adjustments for BUY, SELL, and NET modes on
-- the Transfer Netting Sheet (Maker-Checker audit compliant).
-- ==============================================================================

-- 1. Add adjusted_buy_amount and adjusted_sell_amount to transfer_sheet_lines
ALTER TABLE public.transfer_sheet_lines 
    ADD COLUMN IF NOT EXISTS adjusted_buy_amount NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS adjusted_sell_amount NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS adjustment_category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;

-- 2. Add adjusted_buy_amount, adjusted_sell_amount, and user tracking to transfer_line_adjustments
ALTER TABLE public.transfer_line_adjustments 
    ADD COLUMN IF NOT EXISTS adjusted_buy_amount NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS adjusted_sell_amount NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS adjusted_by UUID,
    ADD COLUMN IF NOT EXISTS adjusted_by_name VARCHAR(255);

-- 3. Ensure check constraint includes all operational adjustment categories
DO $\$
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
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update skipped: %', SQLERRM;
END $\$;

-- 4. Fast foreign key / lookup indexes
CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_line_id 
    ON public.transfer_line_adjustments(line_id);

CREATE INDEX IF NOT EXISTS idx_transfer_line_adjustments_batch_id 
    ON public.transfer_line_adjustments(batch_id);

CREATE INDEX IF NOT EXISTS idx_transfer_sheet_lines_batch_id 
    ON public.transfer_sheet_lines(batch_id);
