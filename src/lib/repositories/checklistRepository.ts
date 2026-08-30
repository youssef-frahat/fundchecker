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

    // Deduplicate by checklist_code so exactly the 4 operational checklist items are displayed
    const codeOrder = ['CHK-01', 'CHK-02', 'CHK-03', 'CHK-04'];
    const checklistMap = new Map<string, ChecklistItem>();

    for (const item of data) {
      const code = String(item.checklist_code || 'CHK-01');
      const completedAtStr = item.completed_at ? String(item.completed_at) : undefined;
      const isCompleted = Boolean(item.is_completed);

      // If we already saw this code, prefer the completed one or first one
      const existing = checklistMap.get(code);
      if (!existing || (!existing.isCompleted && isCompleted)) {
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
          reopenedBy: item.reopened_by ? String(item.reopened_by) : undefined,
          reopenedByName: item.reopened_by_name ? String(item.reopened_by_name) : undefined,
          reopenedAt: item.reopened_at ? String(item.reopened_at) : undefined,
          reopenReason: item.reopen_reason ? String(item.reopen_reason) : undefined,
        });
      }
    }

    // Sort in canonical order CHK-01 -> CHK-04
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
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (err) {
    console.warn('Manual shift reset notice:', err);
  }
}

export async function updateChecklistStatusInDb(
  id: string,
  isCompleted: boolean,
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    const supabase = await getDbClient();
    await supabase
      .from('checklists')
      .update({
        is_completed: isCompleted,
        completed_by: userEmail,
        completed_by_name: userName,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', id);
  } catch (err) {
    console.warn('Checklist repository update notice:', err);
  }
}

export async function reopenChecklistItemInDb(
  id: string,
  userEmail: string,
  userName: string,
  reason: string
): Promise<void> {
  try {
    const supabase = await getDbClient();
    await supabase
      .from('checklists')
      .update({
        is_completed: false,
        reopened_by: userEmail,
        reopened_by_name: userName,
        reopened_at: new Date().toISOString(),
        reopen_reason: reason,
      })
      .eq('id', id);
  } catch (err) {
    console.warn('Checklist repository reopen notice:', err);
  }
}
