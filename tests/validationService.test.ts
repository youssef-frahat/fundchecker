import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RawTransactionRow } from '../src/lib/types';

describe('Validation Engine Rules (SCH-01 & DATA-01)', () => {
  function validateRowBusinessRules(r: RawTransactionRow, seenRequestIds: Set<string>): { valid: boolean; error?: string } {
    if (!r.requestId || r.requestId.trim() === '' || r.requestId.trim() === '-1') {
      return { valid: false, error: 'Invalid mandatory Request ID' };
    }
    if (seenRequestIds.has(r.requestId)) {
      return { valid: false, error: 'Duplicate Request ID detected within file' };
    }
    seenRequestIds.add(r.requestId);

    if (r.orderValue < 0 || r.price < 0 || r.quantity < 0) {
      return { valid: false, error: 'Invalid negative quantity, price, or order value' };
    }

    return { valid: true };
  }

  it('valid transaction row passes all schematic and business checks', () => {
    const seen = new Set<string>();
    const row: RawTransactionRow = {
      id: 'tx-val-1',
      fileId: 'f-1',
      requestId: 'REQ-VALID-01',
      mubasherNo: 'MUB-1',
      customerName: 'Client Valid',
      orderSide: 'BUY',
      symbol: '1001',
      symbolDescription: 'AZ - IDKHAR',
      quantity: 100,
      price: 25,
      orderValue: 2500,
      totalCommission: 5,
      netSettle: 2505,
      orderDate: '2026-08-30',
    };

    const res = validateRowBusinessRules(row, seen);
    assert.equal(res.valid, true);
  });

  it('rejects row with negative price or quantity', () => {
    const seen = new Set<string>();
    const negPriceRow: RawTransactionRow = {
      id: 'tx-val-neg',
      fileId: 'f-1',
      requestId: 'REQ-NEG-01',
      mubasherNo: 'MUB-1',
      customerName: 'Client Neg',
      orderSide: 'BUY',
      symbol: '1001',
      symbolDescription: 'AZ - IDKHAR',
      quantity: 100,
      price: -25, // Negative!
      orderValue: 2500,
      totalCommission: 5,
      netSettle: 2505,
      orderDate: '2026-08-30',
    };

    const res = validateRowBusinessRules(negPriceRow, seen);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('Invalid negative'));
  });

  it('rejects duplicate Request ID in the same spreadsheet', () => {
    const seen = new Set<string>();
    const row1: RawTransactionRow = {
      id: 'tx-dup-1',
      fileId: 'f-1',
      requestId: 'REQ-DUP-1',
      mubasherNo: 'MUB-1',
      customerName: 'Client A',
      orderSide: 'BUY',
      symbol: '1001',
      symbolDescription: 'AZ - IDKHAR',
      quantity: 10,
      price: 10,
      orderValue: 100,
      totalCommission: 0,
      netSettle: 100,
      orderDate: '2026-08-30',
    };
    const row2: RawTransactionRow = { ...row1, id: 'tx-dup-2', customerName: 'Client B' };

    const res1 = validateRowBusinessRules(row1, seen);
    assert.equal(res1.valid, true);

    const res2 = validateRowBusinessRules(row2, seen);
    assert.equal(res2.valid, false);
    assert.ok(res2.error?.includes('Duplicate Request ID'));
  });
});
