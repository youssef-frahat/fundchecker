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
});
