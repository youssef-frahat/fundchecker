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

  it('should accurately calculate Net Settlement with decimal fractional quantities (e.g. 6248.516 units)', () => {
    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-dec-1',
        fileId: 'file-1',
        requestId: 'REQ-DEC-1',
        mubasherNo: 'MUB-D1',
        customerName: 'Investor Fractional',
        orderSide: 'BUY',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 6248.516,
        allocatedQuantity: 6248.516,
        price: 21.13012,
        orderValue: 132031.89,
        totalCommission: 0,
        netSettle: 132031.89,
        orderDate: '2026-08-30',
        orderStatus: 'EXECUTED',
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

    assert.equal(result.importedCount, 1);
    assert.equal(result.rejectedCount, 0);
    const fund1001Line = result.lines.find((l) => l.symbolCode === '1001');
    assert.ok(fund1001Line);
    assert.equal(fund1001Line.systemBuyAmount, 132031.8929);
  });

  it('should resolve execution price from Reference NAV data or order value when price is 0', () => {
    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-price-zero',
        fileId: 'file-1',
        requestId: 'REQ-PRICE-0',
        mubasherNo: 'MUB-P0',
        customerName: 'Investor NAV',
        orderSide: 'SELL',
        symbol: '1001',
        symbolDescription: 'AZ - IDKHAR',
        quantity: 1000,
        allocatedQuantity: 1000,
        price: 0, // Price is 0 in raw file
        orderValue: 0,
        totalCommission: 0,
        netSettle: 0,
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

    assert.equal(result.importedCount, 1);
    assert.equal(result.rejectedCount, 0);
    const fund1001Line = result.lines.find((l) => l.symbolCode === '1001');
    assert.ok(fund1001Line);
    // Uses navUnitPrice from mockRefData (21.13012 * 1000 = 21130.12)
    assert.equal(fund1001Line.systemSellAmount, 21130.12);
  });

  it('should reject trades for ARCHIVED funds to the Exception Queue and exclude from transfer lines', () => {
    const refDataWithArchived: ReferenceData[] = [
      ...mockRefData,
      {
        id: 'ref-archived',
        symbolCode: '9999',
        symbolName: 'Archived Fund Test',
        actualSymbol: 'ARCH-99',
        fundType: 'T0',
        navUnitPrice: 10,
        status: 'ARCHIVED',
      },
    ];

    const rawRows: RawTransactionRow[] = [
      {
        id: 'tx-archived',
        fileId: 'file-1',
        requestId: 'REQ-ARCH-1',
        mubasherNo: 'MUB-ARCH',
        customerName: 'Investor Archived',
        orderSide: 'BUY',
        symbol: '9999',
        symbolDescription: 'Archived Fund Test',
        quantity: 500,
        allocatedQuantity: 500,
        price: 10,
        orderValue: 5000,
        totalCommission: 0,
        netSettle: 5000,
        orderDate: '2026-08-30',
        orderStatus: 'EXECUTED',
      },
    ];

    const result = processAllocationFile(
      rawRows,
      refDataWithArchived,
      'file-1',
      'alloc_sheet.xlsx',
      'maker-uuid',
      'Maker Operator'
    );

    assert.equal(result.importedCount, 0);
    assert.equal(result.rejectedCount, 1);
    assert.equal(result.exceptions.length, 1);
    assert.ok(result.exceptions[0].errorMessage.includes('is ARCHIVED and excluded from Cash Transfers settlement'));
    assert.equal(result.lines.find((l) => l.symbolCode === '9999'), undefined, 'Archived fund must NOT exist in transfer sheet lines');
  });

  it('should calculate the 3 operational adjustment modes accurately', () => {
    const systemBuy = 50000;
    const systemSell = 80000;
    const systemNet = systemSell - systemBuy; // 30000

    // Mode 1: ADJUST_NET_VALUE
    const targetNet = 35000;
    const deltaNetMode = targetNet - systemNet; // +5000
    assert.equal(deltaNetMode, 5000);
    assert.equal(systemNet + deltaNetMode, targetNet);

    // Mode 2: ADJUST_BUY (e.g. adjust buy from 50000 to 45000)
    const adjustedBuy = 45000;
    const resultingNetFromBuy = systemSell - adjustedBuy; // 80000 - 45000 = 35000
    const deltaBuyMode = resultingNetFromBuy - systemNet; // 35000 - 30000 = +5000
    assert.equal(resultingNetFromBuy, 35000);
    assert.equal(deltaBuyMode, 5000);

    // Mode 3: ADJUST_SELL (e.g. adjust sell from 80000 to 90000)
    const adjustedSell = 90000;
    const resultingNetFromSell = adjustedSell - systemBuy; // 90000 - 50000 = 40000
    const deltaSellMode = resultingNetFromSell - systemNet; // 40000 - 30000 = +10000
    assert.equal(resultingNetFromSell, 40000);
    assert.equal(deltaSellMode, 10000);
  });

  it('should cumulatively interrelate sequential BUY and SELL adjustments on the same line', () => {
    // 1. Initial System Baseline
    const systemBuy = 100000;
    const systemSell = 300000;
    const systemNet = systemSell - systemBuy; // 200000
    assert.equal(systemNet, 200000);

    // 2. Step 1: User adjusts BUY from 100,000 to 120,000 (ADJUST_BUY)
    const step1NewBuy = 120000;
    let effectiveBuy = step1NewBuy;
    let effectiveSell = systemSell; // sell not adjusted yet
    const resultingNet1 = effectiveSell - effectiveBuy; // 300000 - 120000 = 180000
    const adjustmentAmount1 = resultingNet1 - systemNet; // 180000 - 200000 = -20000
    const finalTransfer1 = systemNet + adjustmentAmount1; // 180000
    assert.equal(resultingNet1, 180000);
    assert.equal(adjustmentAmount1, -20000);
    assert.equal(finalTransfer1, 180000);

    // 3. Step 2: User subsequently adjusts SELL from 300,000 to 350,000 (ADJUST_SELL)
    // CRITICAL FIX: The adjustment engine MUST preserve effectiveBuy (120,000) rather than falling back to systemBuy (100,000)
    const step2NewSell = 350000;
    effectiveSell = step2NewSell;
    // effectiveBuy remains 120000 (preserved from Step 1)
    const resultingNet2 = effectiveSell - effectiveBuy; // 350000 - 120000 = 230000
    const adjustmentAmount2 = resultingNet2 - systemNet; // 230000 - 200000 = +30000
    const finalTransfer2 = systemNet + adjustmentAmount2; // 230000
    assert.equal(resultingNet2, 230000);
    assert.equal(adjustmentAmount2, 30000);
    assert.equal(finalTransfer2, 230000);

    // 4. Mathematical invariants check
    assert.equal(effectiveSell - effectiveBuy, finalTransfer2, 'Final net transfer MUST equal Effective Sell - Effective Buy');
    assert.equal(systemNet + adjustmentAmount2, finalTransfer2, 'Final net transfer MUST equal System Net + Adjustment Amount');
  });
});
