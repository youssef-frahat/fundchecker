// Dynamic Fund Rule Engine - T0 / T1 Visibility Evaluator

import { FundRule, GeneratedTransactionRow, RawTransactionRow, SettlementType } from './types';

// Default system rule matrices
export const DEFAULT_FUND_RULES: FundRule[] = [
  { id: 'rule-1', fundType: 'T0', orderSide: 'BUY', isTransactionValueVisible: true, isQuantityVisible: true },
  { id: 'rule-2', fundType: 'T0', orderSide: 'SELL', isTransactionValueVisible: true, isQuantityVisible: true },
  { id: 'rule-3', fundType: 'T1', orderSide: 'BUY', isTransactionValueVisible: true, isQuantityVisible: false },
  { id: 'rule-4', fundType: 'T1', orderSide: 'SELL', isTransactionValueVisible: false, isQuantityVisible: true },
];

/**
 * Applies dynamic fund settlement rules to a raw transaction row.
 * Produces an output row with formatted transaction value and quantity visibilities.
 */
export function applyFundRules(
  rawRow: RawTransactionRow,
  fundType: SettlementType,
  customRules: FundRule[] = DEFAULT_FUND_RULES,
  processDateStr: string = new Date().toLocaleDateString('en-US')
): GeneratedTransactionRow {
  const normalizedSide = rawRow.orderSide.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';
  
  // Find matching rule in database/custom rules
  const matchingRule = customRules.find(
    (r) => r.fundType.toUpperCase() === fundType.toUpperCase() && r.orderSide === normalizedSide
  ) || {
    isTransactionValueVisible: true,
    isQuantityVisible: true,
  };

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
    productName: rawRow.symbolDescription || rawRow.symbol || 'Default Product',
  };
}
