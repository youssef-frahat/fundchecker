// Rule Engine - Database-Driven Fund Settlement Visibility Evaluator
// PRODUCTION MODE: No DEFAULT_FUND_RULES fallback. Callers must supply rules from DB.

import { FundRule, GeneratedTransactionRow, RawTransactionRow, SettlementType } from '../types';

export interface RuleEvaluationResult {
  appliedRule: FundRule;
  generatedRow: GeneratedTransactionRow;
}

/**
 * Applies database fund settlement rules (T0/T1 value & quantity visibility) to a mapped transaction.
 * Callers must provide fundRules fetched from the database — no static fallback is provided.
 */
export function evaluateFundRuleForRow(
  rawRow: RawTransactionRow,
  fundType: SettlementType,
  fundRules: FundRule[],
  processDateStr: string = new Date().toLocaleDateString('en-US')
): RuleEvaluationResult {
  if (!fundRules || fundRules.length === 0) {
    throw new Error(
      `[DB ERROR] evaluateFundRuleForRow: fundRules array is empty. ` +
      `Run supabase/schema.sql to seed the fund_rules table before processing transactions.`
    );
  }

  const normalizedSide = rawRow.orderSide.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';

  // Find matching rule from the database-supplied set
  const matchingRule = fundRules.find(
    (r) => r.fundType.toUpperCase() === fundType.toUpperCase() && r.orderSide === normalizedSide
  );

  if (!matchingRule) {
    throw new Error(
      `[DB ERROR] evaluateFundRuleForRow: No rule found for fundType=${fundType}, orderSide=${normalizedSide}. ` +
      `Verify fund_rules table contains entries for this combination.`
    );
  }

  const transactionValue = matchingRule.isTransactionValueVisible ? rawRow.orderValue : null;
  const qty = matchingRule.isQuantityVisible ? rawRow.quantity : null;

  const generatedRow: GeneratedTransactionRow = {
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

  return {
    appliedRule: matchingRule,
    generatedRow,
  };
}

