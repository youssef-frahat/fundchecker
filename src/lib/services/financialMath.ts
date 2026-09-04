// Financial Math Engine - High-Precision Decimal.js Arithmetic
// Eliminates IEEE-754 binary floating-point rounding errors for currency & unit settlements.

import { Decimal } from 'decimal.js';

// Configure Decimal defaults for financial calculations
// 28 digits of precision, Banker's rounding (ROUND_HALF_EVEN) or standard financial (ROUND_HALF_UP)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: number | string | Decimal | undefined | null): Decimal {
  if (value === undefined || value === null || value === '') {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  try {
    const cleaned = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    return new Decimal(cleaned);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Rounds a Decimal to a fixed decimal scale (default 4 decimal places for unit pricing).
 */
export function roundFinancial(
  value: number | string | Decimal,
  decimals: number = 4
): number {
  const d = toDecimal(value);
  return d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * High-precision Addition: a + b
 */
export function addFinancial(
  a: number | string | Decimal,
  b: number | string | Decimal,
  decimals: number = 4
): number {
  const res = toDecimal(a).plus(toDecimal(b));
  return res.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * High-precision Subtraction: a - b
 */
export function subFinancial(
  a: number | string | Decimal,
  b: number | string | Decimal,
  decimals: number = 4
): number {
  const res = toDecimal(a).minus(toDecimal(b));
  return res.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * High-precision Multiplication: a × b (e.g. Quantity × Price)
 */
export function mulFinancial(
  a: number | string | Decimal,
  b: number | string | Decimal,
  decimals: number = 4
): number {
  const res = toDecimal(a).times(toDecimal(b));
  return res.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * High-precision Division: a / b
 */
export function divFinancial(
  a: number | string | Decimal,
  b: number | string | Decimal,
  decimals: number = 4
): number {
  const bDec = toDecimal(b);
  if (bDec.isZero()) return 0;
  const res = toDecimal(a).dividedBy(bDec);
  return res.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Calculates Net Cash Settlement: System Sell - System Buy
 */
export function calculateNetTransfer(
  sellTotal: number | string | Decimal,
  buyTotal: number | string | Decimal,
  decimals: number = 4
): number {
  return subFinancial(sellTotal, buyTotal, decimals);
}

/**
 * Calculates Final Cash Transfer: System Net + Adjustment Amount
 */
export function calculateFinalTransfer(
  systemNet: number | string | Decimal,
  adjustment: number | string | Decimal,
  decimals: number = 4
): number {
  return addFinancial(systemNet, adjustment, decimals);
}

/**
 * Formats a monetary number for accounting display: (1,234.56) for negative, 1,234.56 for positive.
 */
export function formatAccountingString(
  value: number | string | Decimal,
  fractionDigits: number = 2
): string {
  const d = toDecimal(value);
  const absFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(d.abs().toNumber());

  if (d.isNegative()) {
    return `(${absFormatted})`;
  }
  if (d.isZero()) {
    return '-';
  }
  return absFormatted;
}
