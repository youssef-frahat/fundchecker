// Validation Engine - Comprehensive File Integrity & Row Validation Service

import { ExceptionRecord, RawTransactionRow } from '../types';
import { checkDuplicateFileHash } from '../repositories/tradeRepository';

export interface FileValidationResult {
  isValid: boolean;
  isDuplicateFile: boolean;
  duplicateFileName?: string;
  totalRows: number;
  validRows: RawTransactionRow[];
  invalidRows: { row: RawTransactionRow; reason: string }[];
  exceptions: ExceptionRecord[];
}

/**
 * Validates file hash for duplicate upload detection and performs row-level checks.
 */
export async function validateTradeFile(
  fileHashSha256: string,
  fileName: string,
  rows: RawTransactionRow[],
  currentFileId?: string,
  allowOverwrite: boolean = true
): Promise<FileValidationResult> {
  const exceptions: ExceptionRecord[] = [];
  const validRows: RawTransactionRow[] = [];
  const invalidRows: { row: RawTransactionRow; reason: string }[] = [];

  // 1. File-level Duplicate Check (excluding current file record)
  const existingFile = await checkDuplicateFileHash(fileHashSha256, currentFileId);
  if (existingFile && !allowOverwrite) {
    exceptions.push({
      id: `ex-dup-file-${Date.now()}`,
      fileId: existingFile.id,
      fileName,
      exceptionType: 'DUPLICATE_UPLOAD',
      errorMessage: `File "${fileName}" is an exact duplicate of previously ingested file "${existingFile.fileName}" (SHA-256: ${fileHashSha256}).`,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });

    return {
      isValid: false,
      isDuplicateFile: true,
      duplicateFileName: existingFile.fileName,
      totalRows: rows.length,
      validRows: [],
      invalidRows: rows.map((r) => ({ row: r, reason: 'Duplicate file hash detected' })),
      exceptions,
    };
  }

  // 2. Row-level Schema & Data Validation
  const seenRequestIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;

    // Check mandatory fields (blocking empty, missing, or invalid '-1' placeholders)
    if (!r.requestId || r.requestId.trim() === '' || r.requestId.trim() === '-1') {
      const msg = `Row #${rowNum}: Invalid mandatory Request ID ("${r.requestId || 'EMPTY'}").`;
      exceptions.push({
        id: `ex-val-${rowNum}-${Date.now()}`,
        fileId: r.fileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: msg,
        rawPayload: { row: r },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      invalidRows.push({ row: r, reason: msg });
      continue;
    }

    // Duplicate trade check within file
    if (seenRequestIds.has(r.requestId)) {
      const msg = `Row #${rowNum}: Duplicate Request ID "${r.requestId}" detected within file.`;
      exceptions.push({
        id: `ex-val-dup-${rowNum}-${Date.now()}`,
        fileId: r.fileId,
        fileName,
        exceptionType: 'DUPLICATE_TRADE',
        errorMessage: msg,
        rawPayload: { requestId: r.requestId, row: r },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      invalidRows.push({ row: r, reason: msg });
      continue;
    }
    seenRequestIds.add(r.requestId);

    // Negative order value validation
    if (r.orderValue < 0 || r.price < 0 || r.quantity < 0) {
      const msg = `Row #${rowNum} (Req ID: ${r.requestId}): Invalid negative quantity, price, or order value.`;
      exceptions.push({
        id: `ex-val-neg-${rowNum}-${Date.now()}`,
        fileId: r.fileId,
        fileName,
        exceptionType: 'SCHEMATIC_ERR',
        errorMessage: msg,
        rawPayload: { row: r },
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });
      invalidRows.push({ row: r, reason: msg });
      continue;
    }

    validRows.push(r);
  }

  return {
    isValid: invalidRows.length === 0,
    isDuplicateFile: false,
    totalRows: rows.length,
    validRows,
    invalidRows,
    exceptions,
  };
}
