// Reference Data Server Actions (Server-side authorization & PostgreSQL CRUD)
// REMEDIATED SEC-02 & ARC-01: Authenticated, Super Admin only, full audit trail.

'use server';

import { headers } from 'next/headers';
import { getAuthenticatedServerUser } from '@/lib/supabase-server';
import {
  insertReferenceDataInDb,
  updateReferenceDataInDb,
  archiveReferenceDataInDb,
  deleteReferenceDataInDb,
  upsertReferenceDataBatchInDb,
  restoreCanonicalMasterDataInDb,
} from '@/lib/repositories/referenceRepository';
import { insertAuditLog } from '@/lib/repositories/auditRepository';
import { ReferenceData } from '@/lib/types';

async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1'
    );
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Creates a new fund reference data record.
 */
export async function createReferenceDataAction(
  item: Omit<ReferenceData, 'id'>
): Promise<{ success: boolean; data?: ReferenceData; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: '403 Forbidden: Super Admin privileges required.' };
    }

    const created = await insertReferenceDataInDb(item, caller.id);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: 'CREATE_REFERENCE_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: created.id,
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: {
        symbolCode: created.symbolCode,
        symbolName: created.symbolName,
        fundType: created.fundType,
      },
    });

    return { success: true, data: created };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create reference data.',
    };
  }
}

/**
 * Updates an existing fund reference data record.
 */
export async function updateReferenceDataAction(
  item: ReferenceData
): Promise<{ success: boolean; data?: ReferenceData; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: '403 Forbidden: Super Admin privileges required.' };
    }

    const updated = await updateReferenceDataInDb(item);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: 'UPDATE_REFERENCE_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: updated.id,
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: {
        symbolCode: updated.symbolCode,
        symbolName: updated.symbolName,
        fundType: updated.fundType,
        status: updated.status,
        scheduleFrequency: updated.scheduleFrequency,
        executionInstruction: updated.executionInstruction,
      },
    });

    return { success: true, data: updated };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update reference data.',
    };
  }
}

/**
 * Archives or restores a fund reference record.
 */
export async function archiveReferenceDataAction(
  id: string,
  status: 'ACTIVE' | 'ARCHIVED'
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: '403 Forbidden: Super Admin privileges required.' };
    }

    await archiveReferenceDataInDb(id, status);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: status === 'ARCHIVED' ? 'ARCHIVE_REFERENCE_DATA' : 'RESTORE_REFERENCE_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: id,
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: { status },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to change reference data status.',
    };
  }
}

/**
 * Permanently deletes a fund reference record.
 */
export async function deleteReferenceDataAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: '403 Forbidden: Super Admin privileges required.' };
    }

    await deleteReferenceDataInDb(id);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: 'DELETE_REFERENCE_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: id,
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: { deletedId: id },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete reference data.',
    };
  }
}

/**
 * Bulk imports / upserts Master Data funds from Excel parser.
 */
export async function bulkImportReferenceDataAction(
  items: Omit<ReferenceData, 'id'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, count: 0, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, count: 0, error: '403 Forbidden: Super Admin privileges required.' };
    }

    if (!items || items.length === 0) {
      return { success: false, count: 0, error: 'No valid fund records found in file.' };
    }

    const { count } = await upsertReferenceDataBatchInDb(items, caller.id);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: 'BULK_IMPORT_MASTER_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: 'BULK_IMPORT',
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: {
        totalImported: count,
        symbols: items.slice(0, 10).map((i) => i.symbolCode),
      },
    });

    return { success: true, count };
  } catch (err: unknown) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to bulk import master data.',
    };
  }
}

/**
 * Restores canonical master data (68 funds) and exact operational instructions.
 * Restricted to Super Admin only, with full audit logging.
 */
export async function restoreCanonicalMasterDataAction(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller) {
      return { success: false, count: 0, error: '401 Unauthorized: Authentication required.' };
    }
    if (caller.role !== 'SUPER_ADMIN') {
      return { success: false, count: 0, error: '403 Forbidden: Super Admin privileges required.' };
    }

    const { restoredCount } = await restoreCanonicalMasterDataInDb(caller.id);
    const ip = await getClientIp();

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: caller.id,
      userName: caller.fullName,
      action: 'RESTORE_CANONICAL_MASTER_DATA',
      entityName: 'REFERENCE_DATA',
      entityId: 'CANONICAL_FUNDS_RESTORE',
      ipAddress: ip,
      timestampUtc: new Date().toISOString(),
      newValues: {
        totalRestored: restoredCount,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, count: restoredCount };
  } catch (err: unknown) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to restore canonical master data.',
    };
  }
}

