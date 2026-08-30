import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processAllocationFile } from '../src/lib/services/allocationEngine';
import type { RawTransactionRow, ReferenceData } from '../src/lib/types';

describe('Allocation Processing Engine (FIN-01 & SEC-01)', () => {
  const mockRefData: ReferenceData[] = [
    {
      id: 'ref-1',
      symbolCode: '1001',
      symbolName: 'AZ - IDKHAR',
      actualSymbol: 'ADKHAR-AZ',
      fundType: 'T0',
      navUnitPrice: 21.13012,
      status: 'ACTIVE',
    },
    {
      id: 'ref-2',
      symbolCode: '1010',
      symbolName: 'AZ - FORAS',
      actualSymbol: 'Azimut Stocks',
      fundType: 'T1',
      navUnitPrice: 52.42922,
      status: 'ACTIVE',
    },
  ];

  it('should accurately calculate Net Settlement: System Sell - System Buy', () => {
    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-1',
        fileId: 'file-1',
        requestId: 'REQ-001',
        mubasherNo: 'MUB-01',
        customerName: 'Investor A',
        orderSide: 'BUY',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 1000,
        allocatedQuantity: 1000,
        price: 25.5,
        orderValue: 25500,
        totalCommission: 0,
        netSettle: 25500,
        orderDate: '2026-08-30',
        orderStatus: 'EXECUTED',
      },
      {
        id: 'tx-2',
        fileId: 'file-1',
        requestId: 'REQ-002',
        mubasherNo: 'MUB-02',
        customerName: 'Investor B',
        orderSide: 'SELL',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 3000,
        allocatedQuantity: 3000,
        price: 25.5,
        orderValue: 76500,
        totalCommission: 0,
        netSettle: 76500,
        orderDate: '2026-08-30',
        orderStatus: 'APPROVED',
      },
    ];

    const result = processAllocationFile(
      rawRows,
      mockRefData,
      'file-1',
      'alloc_sheet.xlsx',
      'maker-uuid',
      'Maker Operator'
    );

    assert.equal(result.importedCount, 2);
    assert.equal(result.rejectedCount, 0);

    const fund1001Line = result.lines.find((l) => l.symbolCode === '1001');
    assert.ok(fund1001Line, 'Line for fund 1001 must exist');
    assert.equal(fund1001Line.systemBuyAmount, 25500);
    assert.equal(fund1001Line.systemSellAmount, 76500);
    // Net: Sell (76500) - Buy (25500) = +51000
    assert.equal(fund1001Line.systemNetAmount, 51000);
    assert.equal(fund1001Line.finalTransferAmount, 51000);
  });

  it('should reject invalid rows with empty or placeholder "-1" Request IDs to Exception Queue', () => {
    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-bad-1',
        fileId: 'file-1',
        requestId: '-1', // Invalid placeholder
        mubasherNo: 'MUB-B1',
        customerName: 'Bad 1',
        orderSide: 'BUY',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 100,
        price: 10,
        orderValue: 1000,
        totalCommission: 0,
        netSettle: 1000,
        orderDate: '2026-08-30',
        orderStatus: 'APPROVED',
      },
      {
        id: 'tx-bad-2',
        fileId: 'file-1',
        requestId: '', // Empty
        mubasherNo: 'MUB-B2',
        customerName: 'Bad 2',
        orderSide: 'BUY',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 100,
        price: 10,
        orderValue: 1000,
        totalCommission: 0,
        netSettle: 1000,
        orderDate: '2026-08-30',
        orderStatus: 'APPROVED',
      },
    ];

    const result = processAllocationFile(
      rawRows,
      mockRefData,
      'file-1',
      'alloc_sheet.xlsx',
      'maker-uuid',
      'Maker Operator'
    );

    assert.equal(result.importedCount, 0);
    assert.equal(result.rejectedCount, 2);
    assert.equal(result.exceptions.length, 2);
    assert.equal(result.exceptions[0].exceptionType, 'SCHEMATIC_ERR');
  });

  it('should reject unapproved non-executed order statuses', () => {
    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-rej-1',
        fileId: 'file-1',
        requestId: 'REQ-REJECTED',
        mubasherNo: 'MUB-R1',
        customerName: 'Rejected Client',
        orderSide: 'BUY',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 100,
        price: 10,
        orderValue: 1000,
        totalCommission: 0,
        netSettle: 1000,
        orderDate: '2026-08-30',
        orderStatus: 'REJECTED_BY_BROKER', // Unapproved
      },
    ];

    const result = processAllocationFile(
      rawRows,
      mockRefData,
      'file-1',
      'alloc_sheet.xlsx',
      'maker-uuid',
      'Maker Operator'
    );

    assert.equal(result.importedCount, 0);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.exceptions[0].exceptionType, 'SCHEMATIC_ERR');
    assert.ok(result.exceptions[0].errorMessage.includes('not approved for cash settlement'));
  });
});
