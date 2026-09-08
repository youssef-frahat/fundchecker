-- ==============================================================================
-- UPDATE ADJUSTMENT CATEGORIES IN SUPABASE POSTGRESQL
-- Adds ADJUST_NET_VALUE, ADJUST_BUY, ADJUST_SELL to transfer_line_adjustments
-- ==============================================================================

DO $$
BEGIN
    -- Drop existing check constraint if present
    ALTER TABLE public.transfer_line_adjustments
        DROP CONSTRAINT IF EXISTS transfer_line_adjustments_adjustment_category_check;

    -- Add updated check constraint with the 3 operational adjustment modes
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
END $$;
