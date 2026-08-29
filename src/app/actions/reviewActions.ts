// Review Workflow Server Actions - Zero-Trust Four-Eyes Maker-Checker Guards
// HARDENING: Atomic state transitions, real IP extraction, locked approved status

'use server';

import { headers } from 'next/headers';
import { createSupabaseServerClient, getAuthenticatedServerUser } from '@/lib/supabase-server';
import { insertAuditLog } from '@/lib/repositories/auditRepository';

async function getClientIp(): Promise<string> {
  try {
    const headersList = await headers();
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '0.0.0.0'
    );
  } catch {
    return '0.0.0.0';
  }
}

export async function submitTransferSheetForReviewAction(
  transferSheetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized: Valid session required to submit for review.' };
    }

    const supabase = await createSupabaseServerClient();
    const clientIp = await getClientIp();

    // Atomic update: only DRAFT sheets can be submitted
    const { data, error } = await supabase
      .from('transfer_sheets')
      .update({
        status: 'UNDER_REVIEW',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', transferSheetId)
      .eq('status', 'DRAFT')
      .select('id');

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Invalid state transition: Sheet is not in DRAFT status or does not exist.',
      };
    }

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'SUBMIT_FOR_REVIEW',
      entityName: 'TRANSFER_SHEET',
      entityId: transferSheetId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: { status: 'UNDER_REVIEW', makerUserName: currentUser.fullName },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Submit review error';
    return { success: false, error: msg };
  }
}

export async function approveTransferSheetAction(
  transferSheetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized: Valid session required to approve transfer sheet.' };
    }

    const supabase = await createSupabaseServerClient();
    const clientIp = await getClientIp();

    // 2. Query Record to Enforce Four-Eyes Rule
    const { data: sheetRecord, error: fetchError } = await supabase
      .from('transfer_sheets')
      .select('status, reviewed_by')
      .eq('id', transferSheetId)
      .single();

    if (fetchError || !sheetRecord) {
      return { success: false, error: 'Transfer sheet record not found.' };
    }

    // Guard: Must be submitted for review first
    if (sheetRecord.status !== 'UNDER_REVIEW' || !sheetRecord.reviewed_by) {
      return {
        success: false,
        error: `Cannot approve sheet in '${sheetRecord.status}' status. Sheet must be submitted for review first.`,
      };
    }

    // FOUR-EYES PRINCIPLE: Submitter cannot approve own work
    if (sheetRecord.reviewed_by === currentUser.id) {
      return {
        success: false,
        error: 'Four-Eyes Principle Violation: Maker cannot approve own submitted transfer sheet.',
      };
    }

    // Atomic update with DB-level guard against TOCTOU race conditions
    const { data, error } = await supabase
      .from('transfer_sheets')
      .update({
        status: 'APPROVED',
        approved_by: currentUser.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', transferSheetId)
      .eq('status', 'UNDER_REVIEW')
      .neq('reviewed_by', currentUser.id)
      .select('id');

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Approval failed: Concurrent modification or state conflict detected.',
      };
    }

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'APPROVE_TRANSFER_SHEET',
      entityName: 'TRANSFER_SHEET',
      entityId: transferSheetId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: { status: 'APPROVED', checkerUserName: currentUser.fullName },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Approve transfer sheet error';
    return { success: false, error: msg };
  }
}

export async function rejectTransferSheetAction(
  transferSheetId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized: Valid session required to reject transfer sheet.' };
    }

    const supabase = await createSupabaseServerClient();
    const clientIp = await getClientIp();

    // Atomic update: only UNDER_REVIEW sheets can be rejected. APPROVED sheets are immutable!
    const { data, error } = await supabase
      .from('transfer_sheets')
      .update({
        status: 'DRAFT',
      })
      .eq('id', transferSheetId)
      .eq('status', 'UNDER_REVIEW')
      .select('id');

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Rejection failed: Sheet is not in UNDER_REVIEW status. Approved transfer sheets cannot be rejected.',
      };
    }

    await insertAuditLog({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.fullName,
      action: 'REJECT_TRANSFER_SHEET',
      entityName: 'TRANSFER_SHEET',
      entityId: transferSheetId,
      ipAddress: clientIp,
      timestampUtc: new Date().toISOString(),
      newValues: { status: 'DRAFT', rejectionReason: reason },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reject transfer sheet error';
    return { success: false, error: msg };
  }
}
