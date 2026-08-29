// Dynamic Fund Rule Engine - Database-Driven T0 / T1 Visibility Evaluator
// PRODUCTION MODE: No DEFAULT_FUND_RULES fallback. Rules must be supplied from the database.

import { FundRule, GeneratedTransactionRow, RawTransactionRow, SettlementType } from './types';

/**
 * Applies database fund settlement rules to a raw transaction row.
 * Callers must supply rules fetched from the database — no static fallback is provided.
 */
export function applyFundRules(
  rawRow: RawTransactionRow,
  fundType: SettlementType,
  fundRules: FundRule[],
  processDateStr: string = new Date().toLocaleDateString('en-US')
): GeneratedTransactionRow {
  if (!fundRules || fundRules.length === 0) {
    throw new Error(
      `[DB ERROR] applyFundRules: fundRules array is empty. ` +
      `Run supabase/schema.sql to seed the fund_rules table in the database.`
    );
  }

  const normalizedSide = rawRow.orderSide.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';
  
  // Find matching rule from the database-supplied rules
  let matchingRule = fundRules.find(
    (r) => r.fundType.toUpperCase() === fundType.toUpperCase() && r.orderSide.toUpperCase() === normalizedSide
  );

  // Intelligent fallback for DVP, T2, or custom settlement types
  if (!matchingRule) {
    if (fundType.toUpperCase() === 'DVP' || fundType.toUpperCase() === 'T0') {
      matchingRule = {
        id: `rule-${fundType}-${normalizedSide}`,
        fundType,
        orderSide: normalizedSide,
        isTransactionValueVisible: true,
        isQuantityVisible: true,
      };
    } else {
      matchingRule = {
        id: `rule-${fundType}-${normalizedSide}`,
        fundType,
        orderSide: normalizedSide,
        isTransactionValueVisible: normalizedSide === 'BUY',
        isQuantityVisible: normalizedSide === 'SELL',
      };
    }
  }

  const transactionValue = matchingRule.isTransactionValueVisible ? rawRow.orderValue : null;
  const qty = matchingRule.isQuantityVisible ? rawRow.quantity : null;

  return {
    transactionId: rawRow.requestId,
    transactionType: rawRow.orderSide.toLowerCase() as 'buy' | 'sell',
    transactionDate: processDateStr,
    externalCode: rawRow.mubasherNo,
    name: rawRow.customerName,
    transactionValue,
    qty,
    branchId: 1,
    valueDate: processDateStr,
    icPrice: rawRow.price,
    fees: 0,
    productName: rawRow.symbolDescription || rawRow.symbol || '',
  };
}

