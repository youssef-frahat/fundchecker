// Server Actions for Allocation Processing & Transfer Sheet Lifecycle (4-Eyes Principle)
// Implements: Validation Rules, Exception Center routing, Category Adjustments, Review, Approval & Lock

'use server';

import { headers } from 'next/headers';
import { AdjustmentCategory, RawTransactionRow, TransferSheetBatch } from '@/lib/types';
import { getAuthenticatedServerUser } from '@/lib/supabase-server';
import { fetchAllReferenceData } from '@/lib/repositories/referenceRepository';
import { processAllocationFile } from '@/lib/services/allocationEngine';
import {
  createTransferBatchWithLines,
  fetchLatestTransferBatch,
  recordTransferLineAdjustment,
  updateBatchStatusInDb,
} from '@/lib/repositories/transferRepository';
import { insertUploadedFileRecord } from '@/lib/repositories/tradeRepository';
import { insertAuditLog } from '@/lib/repositories/auditRepository';
import { insertExceptionsBatch } from '@/lib/repositories/exceptionRepository';

export async function getLatestTransferBatchAction(): Promise<TransferSheetBatch | null> {
  try {
    return await fetchLatestTransferBatch();
  } catch {
    return null;
  }
}

export async function uploadAllocationFileAction(
  fileName: string,
  fileHashSha256: string,
  fileSize: number,
  rawRows: RawTransactionRow[]
): Promise<{
  success: boolean;
  batch?: TransferSheetBatch;
  importedCount?: number;
  rejectedCount?: number;
  error?: string;
}> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized: Valid authenticated session required.' };
    }

    if (!fileName || !fileHashSha256 || !rawRows || rawRows.length === 0) {
      return { success: false, error: 'Invalid or empty allocation file.' };
    }

    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    // 1. Create file record marked with fileCategory = 'ALLOCATION'
    const fileId = await insertUploadedFileRecord({
      fileName,
      fileHashSha256,
      fileSize,
      rowCount: rawRows.length,
      uploadedBy: currentUser.id,
      fileCategory: 'ALLOCATION',
      status: 'PARSED',
    });

    // 2. Fetch active reference data for symbol mapping
    const referenceDataList = await fetchAllReferenceData();

    // 3. Process allocation rows through validation rules and calculate initial draft
    const calculation = processAllocationFile(
      rawRows,
      referenceDataList,
      fileId,
      fileName,
      currentUser.id,
      currentUser.fullName
    );

    // 4. Route invalid rows directly to Exception Center
    if (calculation.exceptions.length > 0) {
      try {
        await insertExceptionsBatch(calculation.exceptions);
      } catch (err: unknown) {
        console.warn('Failed to insert some allocation exceptions:', err);
      }
    }

    // 5. Persist Batch and Lines in database
    const batchId = await createTransferBatchWithLines(calculation.batch, calculation.lines);

    // 6. Audit Log
    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'ALLOCATION_FILE_INGESTED',
      entityName: 'TRANSFER_SHEET_BATCH',
      entityId: batchId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: {
        fileName,
        batchNumber: calculation.batch.batchNumber,
        importedCount: calculation.importedCount,
        rejectedCount: calculation.rejectedCount,
        totalNetAmount: calculation.batch.totalNetAmount,
      },
    });

    const persistedBatch = await fetchLatestTransferBatch();

    return {
      success: true,
      batch: persistedBatch || {
        ...calculation.batch,
        id: batchId,
        lines: calculation.lines as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      importedCount: calculation.importedCount,
      rejectedCount: calculation.rejectedCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to ingest allocation file.';
    return { success: false, error: msg };
  }
}

export async function adjustTransferLineAction(
  batchId: string,
  lineId: string,
  symbolCode: string,
  systemNetSnapshot: number,
  oldAdjustmentAmount: number,
  newAdjustmentAmount: number,
  adjustmentCategory: AdjustmentCategory,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized.' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Mandatory reason must be at least 10 characters explaining the adjustment.' };
    }

    const validCategories: AdjustmentCategory[] = [
      'BANK_FEE',
      'SETTLEMENT_DIFFERENCE',
      'CUSTODIAN_CORRECTION',
      'MANUAL_ADJUSTMENT',
      'OTHER',
    ];
    if (!validCategories.includes(adjustmentCategory)) {
      return { success: false, error: 'Invalid adjustment category provided.' };
    }

    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    const recorded = await recordTransferLineAdjustment(
      batchId,
      lineId,
      symbolCode,
      systemNetSnapshot,
      oldAdjustmentAmount,
      newAdjustmentAmount,
      adjustmentCategory,
      reason.trim(),
      currentUser.id,
      currentUser.fullName,
      clientIp
    );

    if (!recorded) {
      return { success: false, error: 'Failed to record line adjustment in database.' };
    }

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'TRANSFER_LINE_ADJUSTED',
      entityName: 'TRANSFER_SHEET_LINE',
      entityId: lineId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      oldValues: { adjustmentAmount: oldAdjustmentAmount },
      newValues: {
        adjustmentAmount: newAdjustmentAmount,
        delta: newAdjustmentAmount - oldAdjustmentAmount,
        adjustmentCategory,
        reason: reason.trim(),
        symbolCode,
        resultingFinalTransfer: systemNetSnapshot + newAdjustmentAmount,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Line adjustment error.';
    return { success: false, error: msg };
  }
}

export async function submitTransferBatchAction(
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) return { success: false, error: '401 Unauthorized.' };

    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    const updated = await updateBatchStatusInDb(batchId, 'PENDING_REVIEW');
    if (!updated) return { success: false, error: 'Failed to submit batch for review.' };

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'SUBMIT_TRANSFER_BATCH_FOR_REVIEW',
      entityName: 'TRANSFER_SHEET_BATCH',
      entityId: batchId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: { status: 'PENDING_REVIEW' },
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Submit batch error.' };
  }
}

export async function reviewTransferBatchAction(
  batchId: string,
  decision: 'APPROVE' | 'REJECT',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) return { success: false, error: '401 Unauthorized.' };

    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    const nextStatus = decision === 'APPROVE' ? 'LOCKED' : 'DRAFT';
    const updated = await updateBatchStatusInDb(batchId, nextStatus, currentUser.id, rejectionReason);
    if (!updated) return { success: false, error: 'Failed to review batch.' };

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: decision === 'APPROVE' ? 'APPROVE_AND_LOCK_TRANSFER_BATCH' : 'REJECT_TRANSFER_BATCH',
      entityName: 'TRANSFER_SHEET_BATCH',
      entityId: batchId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: { status: nextStatus, rejectionReason },
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Review batch error.' };
  }
}
