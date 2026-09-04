// Mapping Engine - Reference Data Symbol & Fund Resolver

import { ExceptionRecord, RawTransactionRow, ReferenceData } from '../types';

export interface MappedRowResult {
  row: RawTransactionRow;
  isMapped: boolean;
  referenceData?: ReferenceData;
  targetSymbolCode: string;
  targetSymbolName: string;
  targetActualSymbol: string;
  exception?: ExceptionRecord;
}

export interface MappingBatchResult {
  mappedRows: MappedRowResult[];
  unmappedCount: number;
  exceptions: ExceptionRecord[];
}

/**
 * Resolves each transaction row's symbol against reference data in database.
 */
export function mapTransactionsToReferenceData(
  rows: RawTransactionRow[],
  referenceDataList: ReferenceData[],
  fileName: string
): MappingBatchResult {
  const mappedRows: MappedRowResult[] = [];
  const exceptions: ExceptionRecord[] = [];
  let unmappedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symClean = (row.symbol || '').trim().toLowerCase();
    const descClean = (row.symbolDescription || '').trim().toLowerCase();

    // Match against symbol_code, actual_symbol, or symbol_name
    const match = referenceDataList.find(
      (r) =>
        r.symbolCode.toLowerCase() === symClean ||
        r.actualSymbol.toLowerCase() === symClean ||
        r.symbolName.toLowerCase() === descClean ||
        r.symbolName.toLowerCase() === symClean ||
        r.symbolCode.toLowerCase() === descClean ||
        r.actualSymbol.toLowerCase() === descClean
    );

    if (match) {
      mappedRows.push({
        row,
        isMapped: true,
        referenceData: match,
        targetSymbolCode: match.symbolCode,
        targetSymbolName: match.symbolName,
        targetActualSymbol: match.actualSymbol,
      });
    } else {
      unmappedCount++;
      const exception: ExceptionRecord = {
        id: crypto.randomUUID(),
        fileId: row.fileId,
        fileName,
        exceptionType: 'UNKNOWN_SYMBOL',
        errorMessage: `Unmapped symbol "${row.symbol}" (${row.symbolDescription}) in Request ID "${row.requestId}".`,
        rawPayload: { row },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      exceptions.push(exception);

      mappedRows.push({
        row,
        isMapped: false,
        targetSymbolCode: row.symbol,
        targetSymbolName: row.symbolDescription || row.symbol,
        targetActualSymbol: row.symbol,
        exception,
      });
    }
  }

  return {
    mappedRows,
    unmappedCount,
    exceptions,
  };
}
