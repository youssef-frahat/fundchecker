// Financial Precision Test Suite (Decimal.js Arithmetic)
// Verifies elimination of IEEE-754 binary floating point rounding anomalies

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFinancial,
  subFinancial,
  mulFinancial,
  divFinancial,
  roundFinancial,
  calculateNetTransfer,
  calculateFinalTransfer,
  formatAccountingString,
} from '../src/lib/services/financialMath';

describe('Financial Math Engine (Decimal.js Precision)', () => {
  it('should eliminate 0.1 + 0.2 IEEE-754 floating point anomaly', () => {
    // In standard JS: 0.1 + 0.2 === 0.30000000000000004
    const standardSum = 0.1 + 0.2;
    assert.notEqual(standardSum, 0.3);

    // In Decimal.js financialMath:
    const financialSum = addFinancial(0.1, 0.2, 4);
    assert.equal(financialSum, 0.3);
  });

  it('should eliminate 1.0 - 0.9 floating point precision loss', () => {
    // In standard JS: 1.0 - 0.9 === 0.09999999999999998
    const standardDiff = 1.0 - 0.9;
    assert.notEqual(standardDiff, 0.1);

    // In Decimal.js financialMath:
    const financialDiff = subFinancial(1.0, 0.9, 4);
    assert.equal(financialDiff, 0.1);
  });

  it('should calculate high-precision multiplication for quantity × price', () => {
    const qty = 6248.516;
    const price = 21.13012;
    const result = mulFinancial(qty, price, 4);
    // 6248.516 * 21.13012 = 132031.89290072 -> rounded to 4 decimals = 132031.8929
    assert.equal(result, 132031.8929);
  });

  it('should handle division and prevent division by zero safely', () => {
    const orderVal = 10000;
    const qty = 3;
    const price = divFinancial(orderVal, qty, 4);
    assert.equal(price, 3333.3333);

    // Safe zero division
    const safeZero = divFinancial(orderVal, 0, 4);
    assert.equal(safeZero, 0);
  });

  it('should correctly calculate Net Cash Settlement and Final Transfer', () => {
    const sellTotal = 500219.3621;
    const buyTotal = 850005.3016;
    const net = calculateNetTransfer(sellTotal, buyTotal, 4);
    assert.equal(net, -349785.9395);

    const adjustment = 50000;
    const finalTransfer = calculateFinalTransfer(net, adjustment, 4);
    assert.equal(finalTransfer, -299785.9395);
  });

  it('should round numbers to specified financial decimal places', () => {
    assert.equal(roundFinancial(123.456789, 2), 123.46);
    assert.equal(roundFinancial(123.456789, 4), 123.4568);
  });

  it('should format numbers with accounting convention (parentheses for negative)', () => {
    assert.equal(formatAccountingString(0, 2), '-');
    assert.equal(formatAccountingString(1250000.5, 2), '1,250,000.50');
    assert.equal(formatAccountingString(-349785.94, 2), '(349,785.94)');
  });
});
