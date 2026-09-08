import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFundRules } from '../src/lib/rule-engine';
import type { FundRule, RawTransactionRow } from '../src/lib/types';

describe('Settlement Rule Engine (FIN-01 / Core Logic)', () => {
  const mockFundRules: FundRule[] = [
    {
      id: 'rule-1',
      fundType: 'T0',
      orderSide: 'BUY',
      isTransactionValueVisible: true,
      isQuantityVisible: true,
    },
    {
      id: 'rule-2',
      fundType: 'T0',
      orderSide: 'SELL',
      isTransactionValueVisible: true,
      isQuantityVisible: true,
    },
    {
      id: 'rule-3',
      fundType: 'T1',
      orderSide: 'BUY',
      isTransactionValueVisible: true,
      isQuantityVisible: false, // T1 BUY hides quantity
    },
    {
      id: 'rule-4',
      fundType: 'T1',
      orderSide: 'SELL',
      isTransactionValueVisible: false, // T1 SELL hides value
      isQuantityVisible: true,
    },
  ];

  const baseRow: RawTransactionRow = {
    id: 'tx-rule-101',
    fileId: 'file-1',
    requestId: 'REQ-101',
    mubasherNo: 'MUB-101',
    customerName: 'Institutional Client',
    orderSide: 'BUY',
    symbol: '1001',
    symbolDescription: 'AZ - IDKHAR',
    quantity: 500,
    price: 20,
    orderValue: 10000,
    totalCommission: 15,
    netSettle: 10015,
    orderDate: '2026-08-30',
  };

  it('T0 BUY should have both transactionValue and quantity visible', () => {
    const res = applyFundRules({ ...baseRow, orderSide: 'BUY' }, 'T0', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, 10000);
    assert.equal(res.qty, 500);
  });

  it('T0 SELL should have both transactionValue and quantity visible', () => {
    const res = applyFundRules({ ...baseRow, orderSide: 'SELL' }, 'T0', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, 10000);
    assert.equal(res.qty, 500);
  });

  it('T1 BUY must show transactionValue and HIDE quantity (null)', () => {
    const res = applyFundRules({ ...baseRow, orderSide: 'BUY' }, 'T1', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, 10000);
    assert.equal(res.qty, null, 'T1 BUY must hide quantity according to institutional settlement rules');
  });

  it('T1 SELL must show quantity and HIDE transactionValue (null)', () => {
    const res = applyFundRules({ ...baseRow, orderSide: 'SELL' }, 'T1', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, null, 'T1 SELL must hide value according to institutional settlement rules');
    assert.equal(res.qty, 500);
  });

  it('should throw Error if fundRules array is empty (enforcing DB seed)', () => {
    assert.throws(
      () => applyFundRules(baseRow, 'T0', [], '2026-08-30'),
      /fundRules array is empty/
    );
  });

  it('Trade Sheet: externalCode must strictly map to Mubasher No', () => {
    const rowWithBoth: RawTransactionRow = {
      ...baseRow,
      mubasherNo: '226752177',
      cashAccountNo: 'ACC-998811',
    };
    const res = applyFundRules(rowWithBoth, 'T0', mockFundRules, '2026-08-30');
    assert.equal(res.externalCode, '226752177', 'External code in trade sheet must strictly be Mubasher No');
  });

  it('Trade Sheet: Transaction Value must strictly take Gross Order Value, never Net Settle', () => {
    const tradeWithCommissions: RawTransactionRow = {
      ...baseRow,
      quantity: 5000,
      price: 6.0,
      orderValue: 30000,
      netSettle: 30162.25,
    };
    const res = applyFundRules(tradeWithCommissions, 'T0', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, 30000, 'Transaction Value must strictly be 30,000 (Order Value), not 30,162.25 (Net Settle)');
    assert.notEqual(res.transactionValue, tradeWithCommissions.netSettle);
  });

  it('Trade Sheet: Contaminated orderValue (e.g. Net Settle passed in) is automatically healed to Quantity x Price', () => {
    const contaminatedTrade: RawTransactionRow = {
      ...baseRow,
      quantity: 62,
      price: 24.1298,
      orderValue: 1497.82, // Contaminated with Net Settle fees
      netSettle: 1497.82,
    };
    const res = applyFundRules(contaminatedTrade, 'T0', mockFundRules, '2026-08-30');
    const expected = Math.round(62 * 24.1298 * 10000) / 10000;
    assert.equal(res.transactionValue, expected, `Transaction Value must be healed to ${expected} (Quantity x Price), not 1497.82`);
    assert.notEqual(res.transactionValue, 1497.82);
  });
});

