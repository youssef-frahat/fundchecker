// Checklist Repository - Database Access for Daily Operational Checklists

import { getDbClient } from '../db-client';
import { ChecklistItem } from '../types';

export async function fetchChecklistsFromDb(): Promise<ChecklistItem[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from('checklists')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    // Canonical order for the 7 Real Egyptian Fund Operational Steps
    const codeOrder = ['CHK-01', 'CHK-02', 'CHK-03', 'CHK-04', 'CHK-05', 'CHK-06', 'CHK-07'];
    const checklistMap = new Map<string, ChecklistItem>();

    for (const item of data) {
      const code = String(item.checklist_code || 'CHK-01');
      const completedAtStr = item.completed_at ? String(item.completed_at) : undefined;
      const isCompleted = Boolean(item.is_completed);

      // Determine approval status (supports dedicated column or status/reopen fallback)
      const hasReopenedApproved = item.reopened_by_name && String(item.reopened_by_name).startsWith('APPROVED_BY:');
      const isApproved = Boolean(item.is_approved) || item.status === 'APPROVED' || Boolean(hasReopenedApproved);

      const approvedByName = item.approved_by_name
        ? String(item.approved_by_name)
        : hasReopenedApproved
        ? String(item.reopened_by_name).replace('APPROVED_BY: ', '')
        : undefined;

      const approvedAt = item.approved_at
        ? String(item.approved_at)
        : (isApproved && item.reopened_at)
        ? String(item.reopened_at)
        : undefined;

      const existing = checklistMap.get(code);
      if (!existing || (!existing.isCompleted && isCompleted) || (!existing.isApproved && isApproved)) {
        checklistMap.set(code, {
          id: String(item.id),
          checklistId: code,
          title: String(item.title),
          description: item.description ? String(item.description) : undefined,
          dueTime: String(item.due_time || '12:00'),
          priority: (item.priority as ChecklistItem['priority']) || 'HIGH',
          mandatory: Boolean(item.mandatory),
          isCompleted,
          completedBy: item.completed_by ? String(item.completed_by) : undefined,
          completedByName: item.completed_by_name ? String(item.completed_by_name) : undefined,
          completedAt: completedAtStr,
          isApproved,
          approvedBy: item.approved_by ? String(item.approved_by) : undefined,
          approvedByName,
          approvedAt,
          reopenedBy: item.reopened_by ? String(item.reopened_by) : undefined,
          reopenedByName: !hasReopenedApproved && item.reopened_by_name ? String(item.reopened_by_name) : undefined,
          reopenedAt: !hasReopenedApproved && item.reopened_at ? String(item.reopened_at) : undefined,
          reopenReason: item.reopen_reason ? String(item.reopen_reason) : undefined,
          status: String(item.status || 'ACTIVE'),
        });
      }
    }

    // Sort in canonical order CHK-01 -> CHK-07
    return Array.from(checklistMap.values()).sort((a, b) => {
      const idxA = codeOrder.indexOf(a.checklistId);
      const idxB = codeOrder.indexOf(b.checklistId);
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });
  } catch (err) {
    console.warn('Checklist repository fetch notice:', err);
    return [];
  }
}

export async function resetDailyChecklistsInDb(): Promise<void> {
  try {
    const supabase = await getDbClient();
    await supabase
      .from('checklists')
      .update({
        is_completed: false,
        completed_at: null,
        completed_by: null,
        completed_by_name: null,
        reopened_at: null,
        reopened_by: null,
        reopened_by_name: null,
        reopen_reason: null,
        status: 'ACTIVE',
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (err) {
    console.warn('Manual shift reset notice:', err);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateChecklistStatusInDb(
  id: string,
  isCompleted: boolean,
  userEmail: string,
  userName: string,
  userId?: string
): Promise<void> {
  try {
    const supabase = await getDbClient();
    const resolvedUuid = userId && UUID_REGEX.test(userId)
      ? userId
      : userEmail && UUID_REGEX.test(userEmail)
      ? userEmail
      : null;

    // If operator unchecks (undo), clear completion
    const payload = isCompleted
      ? {
          is_completed: true,
          completed_by: resolvedUuid,
          completed_by_name: userName || userEmail,
          completed_at: new Date().toISOString(),
        }
      : {
          is_completed: false,
          completed_by: null,
          completed_by_name: null,
          completed_at: null,
        };

    if (UUID_REGEX.test(id)) {
      await supabase.from('checklists').update(payload).eq('id', id);
    } else {
      await supabase.from('checklists').update(payload).eq('checklist_code', id);
    }
  } catch (err) {
    console.warn('Checklist repository update notice:', err);
  }
}

export async function approveChecklistItemInDb(
  id: string,
  userEmail: string,
  userName: string,
  userId?: string
): Promise<void> {
  try {
    const supabase = await getDbClient();
    const resolvedUuid = userId && UUID_REGEX.test(userId)
      ? userId
      : userEmail && UUID_REGEX.test(userEmail)
      ? userEmail
      : null;

    const now = new Date().toISOString();
    const approverName = userName || userEmail;

    // Sets status to APPROVED, records approver name and timestamp
    const payload = {
      is_completed: true,
      status: 'APPROVED',
      reopened_by_name: `APPROVED_BY: ${approverName}`,
      reopened_at: now,
    };

    if (UUID_REGEX.test(id)) {
      await supabase.from('checklists').update(payload).eq('id', id);
    } else {
      await supabase.from('checklists').update(payload).eq('checklist_code', id);
    }
  } catch (err) {
    console.warn('Checklist repository approval notice:', err);
  }
}

export async function reopenChecklistItemInDb(
  id: string,
  userEmail: string,
  userName: string,
  reason: string,
  userId?: string
): Promise<void> {
  try {
    const supabase = await getDbClient();
    const resolvedUuid = userId && UUID_REGEX.test(userId)
      ? userId
      : userEmail && UUID_REGEX.test(userEmail)
      ? userEmail
      : null;

    const payload = {
      is_completed: false,
      status: 'ACTIVE',
      reopened_by: resolvedUuid,
      reopened_by_name: userName || userEmail,
      reopened_at: new Date().toISOString(),
      reopen_reason: reason,
    };

    if (UUID_REGEX.test(id)) {
      await supabase.from('checklists').update(payload).eq('id', id);
    } else {
      await supabase.from('checklists').update(payload).eq('checklist_code', id);
    }
  } catch (err) {
    console.warn('Checklist repository reopen notice:', err);
  }
}
