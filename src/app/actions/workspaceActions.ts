// Server Action for Initial Workspace Hydration (Clean Server/Client Boundary)
// PRODUCTION MODE: DB errors are surfaced as error strings, not swallowed as empty arrays.

'use server';

import { fetchAllReferenceData, fetchAllFundRules } from '@/lib/repositories/referenceRepository';
import { fetchOpenExceptions } from '@/lib/repositories/exceptionRepository';
import { fetchAuditLogs } from '@/lib/repositories/auditRepository';
import { fetchChecklistsFromDb } from '@/lib/repositories/checklistRepository';
import { fetchUsersFromDb } from '@/lib/repositories/userRepository';
import { fetchLatestTransferBatch } from '@/lib/repositories/transferRepository';
import { fetchUploadedFilesFromDb } from '@/lib/repositories/tradeRepository';

export async function fetchWorkspaceDataAction(): Promise<{
  success: boolean;
  dbError?: string;
  refData: import('@/lib/types').ReferenceData[];
  fundRules: import('@/lib/types').FundRule[];
  exceptions: import('@/lib/types').ExceptionRecord[];
  auditLogs: import('@/lib/types').AuditLog[];
  checklists: import('@/lib/types').ChecklistItem[];
  users: import('@/lib/types').User[];
  uploadedFiles: import('@/lib/types').UploadedFileRecord[];
  latestBatch: import('@/lib/types').TransferSheetBatch | null;
}> {
  // Fetch non-critical data first (these return [] on empty, not throw)
  const [exceptions, auditLogs, checklists, users, latestBatch, uploadedFiles] = await Promise.all([
    fetchOpenExceptions().catch(() => []),
    fetchAuditLogs(100).catch(() => []),
    fetchChecklistsFromDb().catch(() => []),
    fetchUsersFromDb().catch(() => []),
    fetchLatestTransferBatch().catch(() => null),
    fetchUploadedFilesFromDb().catch(() => []),
  ]);

  // Reference data & fund rules are critical — surface the error explicitly if DB is not seeded
  let refData: import('@/lib/types').ReferenceData[] = [];
  let fundRules: import('@/lib/types').FundRule[] = [];
  let dbError: string | undefined;

  try {
    const [fetchedRef, fetchedRules] = await Promise.all([
      fetchAllReferenceData(),
      fetchAllFundRules(),
    ]);
    refData = fetchedRef;
    fundRules = fetchedRules;
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : 'Database unavailable';
  }

  return {
    success: !dbError,
    dbError,
    refData,
    fundRules,
    exceptions,
    auditLogs,
    checklists,
    users,
    uploadedFiles,
    latestBatch,
  };
}



export async function updateChecklistStatusAction(
  id: string,
  isCompleted: boolean,
  userEmail: string,
  userName: string,
  userId?: string
) {
  const { updateChecklistStatusInDb } = await import('@/lib/repositories/checklistRepository');
  await updateChecklistStatusInDb(id, isCompleted, userEmail, userName, userId);
}

export async function reopenChecklistAction(
  id: string,
  userEmail: string,
  userName: string,
  reason: string,
  userId?: string
) {
  const { reopenChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await reopenChecklistItemInDb(id, userEmail, userName, reason, userId);
}

export async function approveChecklistAction(
  id: string,
  userEmail: string,
  userName: string,
  userId?: string
) {
  const { approveChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await approveChecklistItemInDb(id, userEmail, userName, userId);
}

export async function resolveLateChecklistAction(
  id: string,
  resolution: 'RESOLVED' | 'BREACHED',
  reason: string,
  userEmail: string,
  userName: string,
  userId?: string
) {
  const { resolveLateChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await resolveLateChecklistItemInDb(id, resolution, reason, userEmail, userName, userId);
}

export async function resetDailyChecklistsAction() {
  const { resetDailyChecklistsInDb } = await import('@/lib/repositories/checklistRepository');
  await resetDailyChecklistsInDb();
}

export async function saveAuditLogAction(log: import('@/lib/types').AuditLog) {
  const { getAuthenticatedServerUser } = await import('@/lib/supabase-server');
  const caller = await getAuthenticatedServerUser();
  const { insertAuditLog } = await import('@/lib/repositories/auditRepository');

  const verifiedLog: import('@/lib/types').AuditLog = {
    ...log,
    userId: caller?.id || log.userId,
    userName: caller?.fullName || log.userName,
  };
  await insertAuditLog(verifiedLog);
}

export async function resetDailyChecklistShiftAction() {
  const { resetDailyChecklistsInDb } = await import('@/lib/repositories/checklistRepository');
  await resetDailyChecklistsInDb();
}

export async function fetchAuditLogsAction(limit: number = 200) {
  const { fetchAuditLogs } = await import('@/lib/repositories/auditRepository');
  return await fetchAuditLogs(limit);
}

export async function fetchHistoricalFileRowsAction(fileId: string): Promise<{
  success: boolean;
  fileRecord?: import('@/lib/types').UploadedFileRecord;
  rows?: import('@/lib/types').RawTransactionRow[];
  lines?: import('@/lib/types').TransferSheetLine[];
  isAllocation?: boolean;
  error?: string;
}> {
  try {
    const { getDbClient } = await import('@/lib/db-client');
    const supabase = await getDbClient();

    // 1. Fetch file record
    const { data: file, error: fileErr } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileErr || !file) {
      return { success: false, error: 'File record not found in database.' };
    }

    const fileRecord: import('@/lib/types').UploadedFileRecord = {
      id: String(file.id),
      fileName: file.file_name,
      fileHashSha256: file.file_hash_sha256,
      fileSize: file.file_size,
      rowCount: file.row_count,
      uploadedBy: file.uploaded_by || '',
      uploadedByName: file.uploaded_by_name || 'User',
      uploadedAt: file.uploaded_at,
      fileCategory: file.file_category as 'ORDERS' | 'ALLOCATION',
      status: file.status,
    };

    if (fileRecord.fileCategory === 'ALLOCATION') {
      // Fetch corresponding batch and lines
      const { data: batch } = await supabase
        .from('transfer_sheet_batches')
        .select('id')
        .eq('allocation_file_id', fileId)
        .maybeSingle();

      if (batch?.id) {
        const { data: dbLines } = await supabase
          .from('transfer_sheet_lines')
          .select('*')
          .eq('batch_id', batch.id)
          .order('symbol_code', { ascending: true });

        const lines: import('@/lib/types').TransferSheetLine[] = (dbLines || []).map((l: Record<string, unknown>) => ({
          id: String(l.id),
          batchId: String(l.batch_id),
          symbolCode: String(l.symbol_code),
          symbolName: String(l.symbol_name),
          actualSymbol: typeof l.actual_symbol === 'string' ? l.actual_symbol : undefined,
          systemBuyAmount: Number(l.system_buy_amount) || 0,
          systemSellAmount: Number(l.system_sell_amount) || 0,
          systemNetAmount: (Number(l.system_sell_amount) || 0) - (Number(l.system_buy_amount) || 0),
          adjustmentAmount: Number(l.adjustment_amount) || 0,
          finalTransferAmount:
            (Number(l.system_sell_amount) || 0) -
            (Number(l.system_buy_amount) || 0) +
            (Number(l.adjustment_amount) || 0),
          isManuallyAdjusted: Boolean(l.is_manually_adjusted),
        }));

        return { success: true, fileRecord, lines, isAllocation: true };
      }
    }

    // Otherwise fetch raw orders transactions
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true });

    if (txErr) {
      return { success: false, error: txErr.message };
    }

    const rows: import('@/lib/types').RawTransactionRow[] = (txs || []).map((t: Record<string, unknown>) => ({
      id: String(t.id),
      fileId: String(t.file_id),
      requestId: String(t.request_id || ''),
      mubasherNo: String(t.mubasher_no || ''),
      customerName: String(t.customer_name || ''),
      orderSide: String(t.order_side || 'BUY'),
      symbol: String(t.symbol || ''),
      symbolDescription: String(t.symbol_description || ''),
      quantity: Number(t.quantity) || 0,
      price: Number(t.price) || 0,
      orderValue: Number(t.order_value) || 0,
      totalCommission: Number(t.total_commission) || 0,
      netSettle: Number(t.net_settle) || 0,
      cashAccountNo: typeof t.cash_account_no === 'string' ? t.cash_account_no : undefined,
      isinCode: typeof t.isin_code === 'string' ? t.isin_code : undefined,
      orderDate: String(t.order_date || ''),
    }));

    return { success: true, fileRecord, rows, isAllocation: false };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch historical rows.',
    };
  }
}
