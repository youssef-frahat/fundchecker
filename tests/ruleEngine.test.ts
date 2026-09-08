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

  it('Trade Sheet: Transaction Value directly maps from Order Value (Col L), never Net Settle (Col N)', () => {
    const tradeRow: RawTransactionRow = {
      ...baseRow,
      quantity: 62,
      price: 24.1298,
      orderValue: 1496.0476, // Col L directly from Excel
      netSettle: 1497.82,    // Col N with fees
    };
    const res = applyFundRules(tradeRow, 'T0', mockFundRules, '2026-08-30');
    assert.equal(res.transactionValue, 1496.0476, 'Transaction Value must directly be 1496.0476 from Order Value (Col L)');
    assert.equal(res.qty, 62, 'Quantity must directly be 62 from Quantity column');
    assert.equal(res.rawQty, 62, 'rawQty must preserve exact quantity from Excel cell');
    assert.equal(res.rawOrderValue, 1496.0476, 'rawOrderValue must preserve exact Order Value from Excel cell');
    assert.equal(res.icPrice, 24.1298, 'Price must directly be 24.1298 from Price column');
    assert.notEqual(res.transactionValue, tradeRow.netSettle);

    const t1Res = applyFundRules(tradeRow, 'T1', mockFundRules, '2026-08-30');
    assert.equal(t1Res.qty, null, 'T1 BUY rule hides qty under standard rule');
    assert.equal(t1Res.rawQty, 62, 'rawQty is preserved as 62 without any division by price or equations');
  });
});

