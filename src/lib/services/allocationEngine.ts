// Allocation Processing Engine - Strict Import Validation Rules & Cash Transfer Calculation
// Strictly calculates: System Buy, System Sell, System Net Transfer, Adjustment Amount, Final Transfer Amount

import {
  ExceptionRecord,
  RawTransactionRow,
  ReferenceData,
  TransferSheetBatch,
  TransferSheetLine,
} from '../types';

export interface AllocationPipelineResult {
  batch: Omit<TransferSheetBatch, 'id' | 'createdAt' | 'updatedAt'>;
  lines: Omit<TransferSheetLine, 'id'>[];
  totalAllocatedOrdersCount: number;
  importedCount: number;
  rejectedCount: number;
  exceptions: ExceptionRecord[];
}

/**
 * Validates Allocation rows according to strict business criteria and calculates transfer draft.
 * Validation Rules:
 * 1. Request ID required (non-empty, != '-1')
 * 2. Fund Code required
 * 3. Approved status only (Approved, Executed, Allocated)
 * 4. Allocated Quantity > 0
 * 5. Price > 0
 * 6. Order Side valid (BUY or SELL)
 *
 * Invalid rows are routed to the Exception Center.
 */
export function processAllocationFile(
  allocationRows: RawTransactionRow[],
  referenceDataList: ReferenceData[],
  allocationFileId: string,
  fileName: string,
  makerId: string,
  makerName: string,
  businessDate: string = new Date().toISOString().split('T')[0]
): AllocationPipelineResult {
  const exceptions: ExceptionRecord[] = [];
  let importedCount = 0;
  let rejectedCount = 0;

  // Map to hold aggregated financial values per fund symbol
  const fundMap = new Map<
    string,
    {
      symbolCode: string;
      symbolName: string;
      actualSymbol?: string;
      systemBuyTotal: number;
      systemSellTotal: number;
      orderCount: number;
    }
  >();

  // Pre-populate with all active reference data so every operational fund is accounted for
  for (const ref of referenceDataList) {
    if (ref.status === 'ARCHIVED') continue;
    fundMap.set(ref.symbolCode, {
      symbolCode: ref.symbolCode,
      symbolName: ref.symbolName,
      actualSymbol: ref.actualSymbol,
      systemBuyTotal: 0,
      systemSellTotal: 0,
      orderCount: 0,
    });
  }

  for (let idx = 0; idx < allocationRows.length; idx++) {
    const row = allocationRows[idx];
    const rowNum = idx + 2; // 1-indexed including header row

    // 1. Request ID required
    const reqId = (row.requestId || '').trim();
    if (!reqId || reqId === '-1') {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: `Row ${rowNum}: Request ID is required and cannot be empty or "-1".`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // 2. Fund Code required
    const sym = (row.symbol || '').trim();
    if (!sym) {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'UNKNOWN_SYMBOL',
        errorMessage: `Row ${rowNum}: Fund Symbol Code is missing or empty.`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // 3. Order Side valid
    const rawSide = (row.orderSide || '').toUpperCase().trim();
    const side = rawSide.includes('BUY') ? 'BUY' : rawSide.includes('SELL') ? 'SELL' : null;
    if (!side) {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: `Row ${rowNum}: Invalid Order Side "${row.orderSide}". Must be BUY or SELL.`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // 4. Approved status only
    const status = (row.orderStatus || '').toUpperCase().trim();
    const isApproved =
      status === '' ||
      status.includes('APPROV') ||
      status.includes('EXECUT') ||
      status.includes('ALLOCAT');
    if (!isApproved) {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: `Row ${rowNum}: Order status "${row.orderStatus}" is not approved for cash settlement.`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const allocQty =
      row.allocatedQuantity !== undefined && row.allocatedQuantity > 0
        ? Number(row.allocatedQuantity)
        : Number(row.quantity) || 0;

    if (allocQty <= 0) {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: `Row ${rowNum}: Allocated Quantity must be greater than 0. Found: ${allocQty}.`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // Match symbol with reference data
    const symClean = sym.toLowerCase();
    const descClean = (row.symbolDescription || '').trim().toLowerCase();

    const matchedRef = referenceDataList.find(
      (r) =>
        r.symbolCode.toLowerCase() === symClean ||
        r.actualSymbol.toLowerCase() === symClean ||
        r.symbolName.toLowerCase() === descClean ||
        r.symbolName.toLowerCase() === symClean
    );

    // 6. Price Resolution: Direct Price -> Order Value / Alloc Qty -> Fund Reference NAV Unit Price
    let price = Number(row.price) || 0;
    if (price <= 0) {
      if (row.orderValue && Number(row.orderValue) > 0 && allocQty > 0) {
        price = Number(row.orderValue) / allocQty;
      } else if (matchedRef && matchedRef.navUnitPrice && matchedRef.navUnitPrice > 0) {
        price = matchedRef.navUnitPrice;
      }
    }

    if (price <= 0) {
      rejectedCount++;
      exceptions.push({
        id: crypto.randomUUID(),
        fileId: allocationFileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: `Row ${rowNum}: Execution Price must be greater than 0 and could not be resolved from NAV Reference Data. Found: ${price}.`,
        rawPayload: { rowNum, ...row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // Row is Valid -> Calculate Financial Amount: Allocated Quantity × Price
    const lineExecutionAmount = allocQty * price;
    importedCount++;

    const targetCode = matchedRef ? matchedRef.symbolCode : sym;
    const targetName = matchedRef ? matchedRef.symbolName : row.symbolDescription || sym;
    const targetActual = matchedRef ? matchedRef.actualSymbol : undefined;

    if (!fundMap.has(targetCode)) {
      fundMap.set(targetCode, {
        symbolCode: targetCode,
        symbolName: targetName,
        actualSymbol: targetActual,
        systemBuyTotal: 0,
        systemSellTotal: 0,
        orderCount: 0,
      });
    }

    const fundAgg = fundMap.get(targetCode)!;
    if (side === 'BUY') {
      fundAgg.systemBuyTotal += lineExecutionAmount;
    } else {
      fundAgg.systemSellTotal += lineExecutionAmount;
    }
    fundAgg.orderCount++;
  }

  // Generate draft lines
  const lines: Omit<TransferSheetLine, 'id'>[] = [];
  let totalBatchBuy = 0;
  let totalBatchSell = 0;

  for (const agg of fundMap.values()) {
    const systemBuy = Math.round(agg.systemBuyTotal * 10000) / 10000;
    const systemSell = Math.round(agg.systemSellTotal * 10000) / 10000;
    const systemNet = Math.round((systemSell - systemBuy) * 10000) / 10000;
    const initialAdjustment = 0;
    const finalTransfer = systemNet + initialAdjustment;

    totalBatchBuy += systemBuy;
    totalBatchSell += systemSell;

    lines.push({
      batchId: '',
      symbolCode: agg.symbolCode,
      symbolName: agg.symbolName,
      actualSymbol: agg.actualSymbol,
      systemBuyAmount: systemBuy,
      systemSellAmount: systemSell,
      systemNetAmount: systemNet,
      adjustmentAmount: initialAdjustment,
      finalTransferAmount: finalTransfer,
      isManuallyAdjusted: false,
    });
  }

  // Sort alphabetically by Symbol Code
  lines.sort((a, b) => a.symbolCode.localeCompare(b.symbolCode, undefined, { sensitivity: 'base' }));

  const totalBatchNet = Math.round((totalBatchSell - totalBatchBuy) * 10000) / 10000;
  const batchNumber = `TRF-${businessDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

  const batch: Omit<TransferSheetBatch, 'id' | 'createdAt' | 'updatedAt'> = {
    batchNumber,
    allocationFileId,
    businessDate,
    status: 'DRAFT',
    totalBuyAmount: Math.round(totalBatchBuy * 10000) / 10000,
    totalSellAmount: Math.round(totalBatchSell * 10000) / 10000,
    totalNetAmount: totalBatchNet,
    makerId,
    makerName,
  };

  return {
    batch,
    lines,
    totalAllocatedOrdersCount: importedCount,
    importedCount,
    rejectedCount,
    exceptions,
  };
}
