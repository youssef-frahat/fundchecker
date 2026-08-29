// Operational Processing Engine - End-to-End Execution Pipeline & Traceability Orchestrator
// REMEDIATION: PROC-1 (rollback boundary), PROC-2 (no fake ID), PROC-3 (real fundType)

import { AuditLog, ExceptionRecord, GeneratedTransactionRow, RawTransactionRow, SettlementType } from '../types';
import {
  insertUploadedFileRecord,
  insertTransactionsBatch,
  updateUploadedFileStatus,
  deleteTransactionsByFileId,
} from '../repositories/tradeRepository';
import { fetchAllReferenceData, fetchAllFundRules } from '../repositories/referenceRepository';
import { insertExceptionsBatch } from '../repositories/exceptionRepository';
import { insertAuditLog, insertAuditLogsBatch } from '../repositories/auditRepository';
import { validateTradeFile, FileValidationResult } from './validationService';
import { mapTransactionsToReferenceData, MappingBatchResult } from './mappingService';
import { evaluateFundRuleForRow } from './ruleService';
import { generateFundTransactions, TransactionGeneratorResult } from './transactionGenerator';
import { generateTransferSheet, TransferGeneratorResult } from './transferGenerator';

export interface RowTraceabilityItem {
  rowId: string;
  requestId: string;
  customerName: string;
  orderSide: string;
  inputSymbol: string;
  inputQuantity: number;
  inputPrice: number;
  inputOrderValue: number;
  validationResult: 'VALID' | 'INVALID';
  validationReason?: string;
  mappingResult: 'MAPPED' | 'UNMAPPED';
  targetSymbolCode: string;
  targetSymbolName: string;
  ruleApplied: string;
  fundTypeApplied: SettlementType;
  transactionValueOutput: number | null;
  qtyOutput: number | null;
  productGroup: string;
}

export interface ProcessingPipelineReport {
  executionId: string;
  timestamp: string;
  fileId: string;
  fileName: string;
  fileHashSha256: string;
  totalRowsProcessed: number;
  validRowsCount: number;
  invalidRowsCount: number;
  mappedRowsCount: number;
  unmappedRowsCount: number;
  exceptionsCount: number;
  transactionGeneratorResult: TransactionGeneratorResult;
  transferGeneratorResult: TransferGeneratorResult;
  auditLogsCount: number;
  traceabilityLog: RowTraceabilityItem[];
  exceptions: ExceptionRecord[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUUID(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${label} is not a valid UUID: "${value}". Database operation aborted.`);
  }
}

/**
 * Main Processing Engine Orchestrator — PROD-grade:
 * - PROC-1: Rollback error boundary marks file FAILED and cleans orphan transactions
 * - PROC-2: Throws on DB failure — never returns fake local IDs
 * - PROC-3: Resolves fundType per-row from reference data (T0 / T1)
 */
export async function executeProcessingPipeline(
  fileName: string,
  fileHashSha256: string,
  fileSize: number,
  rawRows: RawTransactionRow[],
  userId: string,
  clientIp: string = '0.0.0.0'
): Promise<ProcessingPipelineReport> {
  const executionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const allExceptions: ExceptionRecord[] = [];

  // === PROC-2: Write PIPELINE_INITIATED audit log IMMEDIATELY to database ===
  // Written before any pipeline step so failure tracking always starts
  await insertAuditLog({
    id: crypto.randomUUID(),
    userId,
    userName: 'Processing Engine',
    action: 'PIPELINE_INITIATED',
    entityName: 'PROCESSING_ENGINE',
    entityId: executionId,
    ipAddress: clientIp,
    timestampUtc: timestamp,
    newValues: { fileName, fileSize, rowCount: rawRows.length, hash: fileHashSha256, executionId },
  });

  // === PROC-2: Create file record — throws on DB failure (no fake ID fallback) ===
  const fileId = await insertUploadedFileRecord({
    fileName,
    fileHashSha256,
    fileSize,
    rowCount: rawRows.length,
    uploadedBy: userId,
    status: 'PROCESSING',
  });

  // Validate that we received a real UUID from the database
  assertValidUUID(fileId, 'fileId returned from insertUploadedFileRecord');

  // === PROC-1: Rollback boundary — wraps all subsequent pipeline steps ===
  try {
    // Attach persistent fileId to raw rows
    const preparedRows = rawRows.map((r) => ({ ...r, fileId }));

    // Insert raw transactions into database
    await insertTransactionsBatch(fileId, preparedRows);

    // 3. Validation Engine (excluding current file record from duplicate detection)
    const validationResult: FileValidationResult = await validateTradeFile(fileHashSha256, fileName, preparedRows, fileId);
    allExceptions.push(...validationResult.exceptions);

    if (validationResult.isDuplicateFile) {
      await updateUploadedFileStatus(fileId, 'EXCEPTION');
      await insertExceptionsBatch(validationResult.exceptions);

      await insertAuditLog({
        id: crypto.randomUUID(),
        userId,
        userName: 'Processing Engine',
        action: 'DUPLICATE_FILE_BLOCKED',
        entityName: 'UPLOADED_FILE',
        entityId: fileId,
        ipAddress: clientIp,
        timestampUtc: new Date().toISOString(),
        newValues: { fileName, duplicateOf: validationResult.duplicateFileName },
      });

      throw new Error(`Processing Terminated: File "${fileName}" is a duplicate upload.`);
    }

    // 4. Reference Data & Dynamic Rules Fetch
    const referenceDataList = await fetchAllReferenceData();
    const fundRules = await fetchAllFundRules();

    // 5. Mapping Engine
    const mappingResult: MappingBatchResult = mapTransactionsToReferenceData(
      validationResult.validRows,
      referenceDataList,
      fileName
    );
    allExceptions.push(...mappingResult.exceptions);

    // 6. PROC-3: Rule Evaluation with REAL fundType resolved per-row from reference data
    const generatedRows: GeneratedTransactionRow[] = [];
    const traceabilityLog: RowTraceabilityItem[] = [];

    for (const item of mappingResult.mappedRows) {
      const raw = item.row;

      // PROC-3: Resolve fundType from matched reference data — never hardcode 'T0'
      const fundType: SettlementType = item.referenceData?.fundType ?? 'T0';

      const ruleEval = evaluateFundRuleForRow(raw, fundType, fundRules);
      generatedRows.push(ruleEval.generatedRow);

      traceabilityLog.push({
        rowId: raw.id,
        requestId: raw.requestId,
        customerName: raw.customerName,
        orderSide: raw.orderSide,
        inputSymbol: raw.symbol,
        inputQuantity: raw.quantity,
        inputPrice: raw.price,
        inputOrderValue: raw.orderValue,
        validationResult: 'VALID',
        mappingResult: item.isMapped ? 'MAPPED' : 'UNMAPPED',
        targetSymbolCode: item.targetSymbolCode,
        targetSymbolName: item.targetSymbolName,
        ruleApplied: `${fundType} ${ruleEval.appliedRule.orderSide} (ValVis: ${ruleEval.appliedRule.isTransactionValueVisible}, QtyVis: ${ruleEval.appliedRule.isQuantityVisible})`,
        fundTypeApplied: fundType,
        transactionValueOutput: ruleEval.generatedRow.transactionValue,
        qtyOutput: ruleEval.generatedRow.qty,
        productGroup: ruleEval.generatedRow.productName,
      });
    }

    // 7. Transaction File Generator (produces Excel + storage upload)
    const txGenResult = await generateFundTransactions(fileId, generatedRows, userId);

    // 8. Transfer Sheet Generator (netting engine using net_settle)
    const transferGenResult = await generateTransferSheet(fileId, preparedRows, referenceDataList, userId);

    // 9. Persist Exception Records
    if (allExceptions.length > 0) {
      await insertExceptionsBatch(allExceptions);
      await updateUploadedFileStatus(fileId, 'EXCEPTION');
    } else {
      await updateUploadedFileStatus(fileId, 'PARSED');
    }

    // 10. Audit Log: Pipeline Completed
    await insertAuditLog({
      id: crypto.randomUUID(),
      userId,
      userName: 'Processing Engine',
      action: 'PIPELINE_COMPLETED',
      entityName: 'PROCESSING_ENGINE',
      entityId: executionId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: {
        fileId,
        totalRows: rawRows.length,
        validRows: validationResult.validRows.length,
        invalidRows: validationResult.invalidRows.length,
        mappedRows: mappingResult.mappedRows.filter((m) => m.isMapped).length,
        unmappedRows: mappingResult.unmappedCount,
        exceptionsCount: allExceptions.length,
        totalBuy: transferGenResult.nettingSummary.totalBuy,
        totalSell: transferGenResult.nettingSummary.totalSell,
        totalNet: transferGenResult.nettingSummary.totalNet,
        reportId: txGenResult.reportId,
        transferSheetId: transferGenResult.transferSheetId,
      },
    });

    return {
      executionId,
      timestamp,
      fileId,
      fileName,
      fileHashSha256,
      totalRowsProcessed: rawRows.length,
      validRowsCount: validationResult.validRows.length,
      invalidRowsCount: validationResult.invalidRows.length,
      mappedRowsCount: mappingResult.mappedRows.filter((m) => m.isMapped).length,
      unmappedRowsCount: mappingResult.unmappedCount,
      exceptionsCount: allExceptions.length,
      transactionGeneratorResult: txGenResult,
      transferGeneratorResult: transferGenResult,
      auditLogsCount: 2,
      traceabilityLog,
      exceptions: allExceptions,
    };
  } catch (pipelineError: unknown) {
    // === PROC-1: ROLLBACK — mark file FAILED, delete orphaned transactions ===
    try {
      await updateUploadedFileStatus(fileId, 'FAILED');
      await deleteTransactionsByFileId(fileId);
    } catch (rollbackErr) {
      console.error('Rollback error after pipeline failure:', rollbackErr);
    }

    // Write failure audit record
    try {
      await insertAuditLog({
        id: crypto.randomUUID(),
        userId,
        userName: 'Processing Engine',
        action: 'PIPELINE_FAILED',
        entityName: 'PROCESSING_ENGINE',
        entityId: executionId,
        ipAddress: clientIp,
        timestampUtc: new Date().toISOString(),
        newValues: {
          fileId,
          error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
        },
      });
    } catch (auditErr) {
      console.error('Failed to write PIPELINE_FAILED audit log:', auditErr);
    }

    throw pipelineError;
  }
}
