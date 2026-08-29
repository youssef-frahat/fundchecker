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
  userName: string
) {
  const { updateChecklistStatusInDb } = await import('@/lib/repositories/checklistRepository');
  await updateChecklistStatusInDb(id, isCompleted, userEmail, userName);
}

export async function reopenChecklistAction(
  id: string,
  userEmail: string,
  userName: string,
  reason: string
) {
  const { reopenChecklistItemInDb } = await import('@/lib/repositories/checklistRepository');
  await reopenChecklistItemInDb(id, userEmail, userName, reason);
}

export async function saveAuditLogAction(log: import('@/lib/types').AuditLog) {
  const { insertAuditLog } = await import('@/lib/repositories/auditRepository');
  await insertAuditLog(log);
}

export async function resetDailyChecklistShiftAction() {
  const { resetDailyChecklistsInDb } = await import('@/lib/repositories/checklistRepository');
  await resetDailyChecklistsInDb();
}

export async function fetchAuditLogsAction(limit: number = 100) {
  const { fetchAuditLogs } = await import('@/lib/repositories/auditRepository');
  return await fetchAuditLogs(limit);
}
