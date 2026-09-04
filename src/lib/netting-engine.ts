import { NettingRow, RawTransactionRow, ReferenceData } from './types';
import { addFinancial, calculateNetTransfer, roundFinancial } from './services/financialMath';

export interface NettingSummary {
  rows: NettingRow[];
  totalBuy: number;
  totalSell: number;
  totalNet: number;
  totalSymbols: number;
}

export interface FundReviewState {
  reviewStatus: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED';
  makerName?: string;
  checkerName?: string;
  approvedAt?: string;
}

/**
 * Aggregates raw trading transactions into Netting Transfer Rows.
 */
export function calculateNettingSheet(
  transactions: RawTransactionRow[],
  referenceDataList: ReferenceData[],
  groupBy: 'symbol' | 'actual_symbol' = 'symbol',
  perFundReviewStates: Record<string, FundReviewState> = {}
): NettingSummary {
  const map = new Map<string, { buy: number; sell: number; ref?: ReferenceData }>();

  // Initialize map with reference data symbols
  for (const ref of referenceDataList) {
    const key = groupBy === 'actual_symbol' ? ref.actualSymbol : ref.symbolCode;
    if (!map.has(key)) {
      map.set(key, { buy: 0, sell: 0, ref });
    }
  }

  // Aggregate transaction values
  for (const tx of transactions) {
    const rawSymbol = (tx.symbol || '').trim();
    const rawDesc = (tx.symbolDescription || '').trim();
    const refMatch = referenceDataList.find(
      (r) =>
        r.symbolCode.toLowerCase() === rawSymbol.toLowerCase() ||
        r.actualSymbol.toLowerCase() === rawSymbol.toLowerCase() ||
        (rawDesc && r.symbolName.toLowerCase() === rawDesc.toLowerCase())
    );

    const groupKey = groupBy === 'actual_symbol' 
      ? (refMatch?.actualSymbol || rawSymbol) 
      : (refMatch?.symbolCode || rawSymbol);

    if (!map.has(groupKey)) {
      map.set(groupKey, { buy: 0, sell: 0, ref: refMatch });
    }

    const item = map.get(groupKey)!;
    const orderSide = tx.orderSide.toUpperCase();
    // NET-1 REMEDIATION: Use net_settle (after commissions) not order_value (gross notional)
    // net_settle = order_value - total_commission; this is the actual cash transferred to custodian
    const settledValue = tx.netSettle ?? tx.orderValue ?? 0;
    if (orderSide === 'BUY') {
      item.buy = addFinancial(item.buy, settledValue, 4);
    } else if (orderSide === 'SELL') {
      item.sell = addFinancial(item.sell, settledValue, 4);
    }
  }

  const rows: NettingRow[] = [];
  let totalBuy = 0;
  let totalSell = 0;

  for (const [key, val] of map.entries()) {
    const symbolCode = val.ref ? val.ref.symbolCode : key;
    const symbolName = val.ref ? val.ref.symbolName : key;
    const actualSymbol = val.ref ? val.ref.actualSymbol : key;

    const buyTotal = roundFinancial(val.buy, 2);
    const sellTotal = roundFinancial(val.sell, 2);
    const netAmount = calculateNetTransfer(sellTotal, buyTotal, 2);

    let status: 'NEUTRAL' | 'POSITIVE' | 'NEGATIVE' = 'NEUTRAL';
    if (netAmount > 0) status = 'POSITIVE';
    else if (netAmount < 0) status = 'NEGATIVE';

    const isUsd = symbolCode.toUpperCase().includes('USD') || actualSymbol.toUpperCase().includes('USD');
    const fundState = perFundReviewStates[symbolCode] || { reviewStatus: 'DRAFT' };

    rows.push({
      symbolCode,
      symbolName,
      actualSymbol,
      buyTotal,
      sellTotal,
      netAmount,
      currency: isUsd ? 'USD' : 'EGP',
      status,
      reviewStatus: fundState.reviewStatus,
      makerName: fundState.makerName,
      checkerName: fundState.checkerName,
      approvedAt: fundState.approvedAt,
    });

    totalBuy = addFinancial(totalBuy, buyTotal, 2);
    totalSell = addFinancial(totalSell, sellTotal, 2);
  }

  rows.sort((a, b) => a.symbolCode.localeCompare(b.symbolCode));

  const totalNet = calculateNetTransfer(totalSell, totalBuy, 2);

  return {
    rows,
    totalBuy: roundFinancial(totalBuy, 2),
    totalSell: roundFinancial(totalSell, 2),
    totalNet,
    totalSymbols: rows.length,
  };
}

export function formatFinancialNumber(val: number): string {
  if (val === 0 || !val) return '-';
  const absVal = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val < 0 ? `(${absVal})` : absVal;
}
