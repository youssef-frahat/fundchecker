// Server Action for Initial Workspace Hydration (Clean Server/Client Boundary)
// PRODUCTION MODE: DB errors are surfaced as error strings, not swallowed as empty arrays.
// REMEDIATED SEC-02 & ARC-01: Server-side authentication, role authorization, and caller verification.

'use server';

import { fetchAllReferenceData, fetchAllFundRules } from '@/lib/repositories/referenceRepository';
import { fetchOpenExceptions } from '@/lib/repositories/exceptionRepository';
import { fetchAuditLogs } from '@/lib/repositories/auditRepository';
import { fetchChecklistsFromDb } from '@/lib/repositories/checklistRepository';
import { fetchUsersFromDb } from '@/lib/repositories/userRepository';
import { fetchLatestTransferBatch } from '@/lib/repositories/transferRepository';
import { fetchUploadedFilesFromDb } from '@/lib/repositories/tradeRepository';
import { getAuthenticatedServerUser } from '@/lib/supabase-server';

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
  allBatches: import('@/lib/repositories/transferRepository').TransferBatchSummary[];
}> {
  // Fetch non-critical data first (these return [] on empty, not throw)
  const { fetchAllTransferBatches } = await import('@/lib/repositories/transferRepository');
  const [exceptions, auditLogs, checklists, users, latestBatch, uploadedFiles, allBatches] = await Promise.all([
    fetchOpenExceptions().catch(() => []),
    fetchAuditLogs(100).catch(() => []),
    fetchChecklistsFromDb().catch(() => []),
    fetchUsersFromDb().catch(() => []),
    fetchLatestTransferBatch().catch(() => null),
    fetchUploadedFilesFromDb().catch(() => []),
    fetchAllTransferBatches().catch(() => []),
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
    allBatches,
  };
}

export async function fetchTransferBatchByIdAction(batchId: string) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  const { fetchTransferBatchById } = await import('@/lib/repositories/transferRepository');
  return await fetchTransferBatchById(batchId);
}

export async function updateChecklistStatusAction(
  id: string,
  isCompleted: boolean,
  _userEmail?: string,
  _userName?: string,
  _userId?: string
) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required to modify checklist status.');
  }

  const { updateChecklistStatusInDb } = await import('@/lib/repositories/checklistRepository');
  await updateChecklistStatusInDb(id, isCompleted, caller.email, caller.fullName, caller.id);
}

export async function reopenChecklistAction(
  id: string,
  _userEmail: string,
  _userName: string,
  reason: string,
  _userId?: string
) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  if (caller.role !== 'SUPER_ADMIN') {
    throw new Error('403 Forbidden: Only Super Administrators can reopen regulatory checklist items.');
  }

  const { reopenChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await reopenChecklistItemInDb(id, caller.email, caller.fullName, reason, caller.id);
}

export async function approveChecklistAction(
  id: string,
  _userEmail?: string,
  _userName?: string,
  _userId?: string
) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  if (caller.role !== 'SUPER_ADMIN') {
    throw new Error('403 Forbidden: Only Super Administrators can grant official operational sign-off.');
  }

  const { approveChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await approveChecklistItemInDb(id, caller.email, caller.fullName, caller.id);
}

export async function resolveLateChecklistAction(
  id: string,
  resolution: 'RESOLVED' | 'BREACHED',
  reason: string,
  _userEmail?: string,
  _userName?: string,
  _userId?: string
) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  if (caller.role !== 'SUPER_ADMIN') {
    throw new Error('403 Forbidden: Only Super Administrators can resolve late deadline breaches.');
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error('400 Bad Request: Mandatory audit justification reason is required for late checklist resolution.');
  }

  const { resolveLateChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await resolveLateChecklistItemInDb(id, resolution, reason, caller.email, caller.fullName, caller.id);
}

export async function resetDailyChecklistsAction() {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  if (caller.role !== 'SUPER_ADMIN') {
    throw new Error('403 Forbidden: Only Super Administrators can trigger daily shift checklist reset.');
  }
  const { resetDailyChecklistsInDb } = await import('@/lib/repositories/checklistRepository');
  await resetDailyChecklistsInDb();
}

export async function saveAuditLogAction(log: import('@/lib/types').AuditLog) {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required to write audit logs.');
  }
  const { insertAuditLog } = await import('@/lib/repositories/auditRepository');

  const verifiedLog: import('@/lib/types').AuditLog = {
    ...log,
    userId: caller.id,
    userName: caller.fullName,
  };
  await insertAuditLog(verifiedLog);
}

export async function resetDailyChecklistShiftAction() {
  const caller = await getAuthenticatedServerUser();
  if (!caller) {
    throw new Error('401 Unauthorized: Authentication required.');
  }
  if (caller.role !== 'SUPER_ADMIN') {
    throw new Error('403 Forbidden: Only Super Administrators can trigger daily shift checklist reset.');
  }
  const { resetDailyChecklistsInDb } = await import('@/lib/repositories/checklistRepository');
  await resetDailyChecklistsInDb();
}

export async function fetchAuditLogsAction(limit: number = 50, cursor?: string) {
  const { fetchAuditLogsPaginated } = await import('@/lib/repositories/auditRepository');
  return await fetchAuditLogsPaginated(limit, cursor);
}

export async function fetchHistoricalFileRowsAction(
  fileId: string,
  fileHash?: string,
  fileName?: string
): Promise<{
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

    // 1. Fetch file record by UUID, Hash, or FileName
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let file = null;

    if (fileId && UUID_REGEX.test(fileId)) {
      const { data } = await supabase.from('uploaded_files').select('*').eq('id', fileId).maybeSingle();
      file = data;
    }

    if (!file && fileHash) {
      const { data } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('file_hash_sha256', fileHash)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      file = data;
    }

    if (!file && fileName) {
      const { data } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('file_name', fileName)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      file = data;
    }

    if (!file) {
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
      let { data: batch } = await supabase
        .from('transfer_sheet_batches')
        .select('id')
        .eq('allocation_file_id', file.id)
        .maybeSingle();

      if (!batch) {
        const { data: latestB } = await supabase
          .from('transfer_sheet_batches')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        batch = latestB;
      }

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
      .eq('file_id', file.id)
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

export async function resolveExceptionAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Session expired or invalid. Please sign in again.' };
    }
    const { resolveExceptionInDb } = await import('@/lib/repositories/exceptionRepository');
    const result = await resolveExceptionInDb(id, caller.id);
    return { success: result.success, error: result.error };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resolve exception.' };
  }
}

export async function resolveAllExceptionsAction(ids?: string[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Session expired or invalid. Please sign in again.' };
    }
    const { resolveAllExceptionsInDb } = await import('@/lib/repositories/exceptionRepository');
    const result = await resolveAllExceptionsInDb(ids, caller.id);
    return { success: result.success, count: result.count, error: result.error };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to resolve all exceptions.' };
  }
}

export async function cleanResolvedExceptionsAction(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, count: 0, error: '401 Unauthorized: Session expired or invalid. Please sign in again.' };
    }
    const { cleanResolvedExceptionsInDb } = await import('@/lib/repositories/exceptionRepository');
    const result = await cleanResolvedExceptionsInDb();

    if (result.success && result.count > 0) {
      const { headers } = await import('next/headers');
      const headersList = await headers();
      const ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        '127.0.0.1';

      const { insertAuditLog } = await import('@/lib/repositories/auditRepository');
      await insertAuditLog({
        id: crypto.randomUUID(),
        userId: caller.id,
        userName: caller.fullName,
        action: 'CLEAN_RESOLVED_EXCEPTIONS',
        entityName: 'EXCEPTION_QUEUE',
        entityId: 'RESOLVED_BATCH',
        ipAddress,
        timestampUtc: new Date().toISOString(),
        newValues: { purgedCount: result.count },
      });
    }

    return { success: result.success, count: result.count, error: result.error };
  } catch (err: unknown) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to clean resolved exceptions.',
    };
  }
}
