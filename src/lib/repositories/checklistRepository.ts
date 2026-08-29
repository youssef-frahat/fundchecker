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

    // Helper: checks if timestamp occurred during today's Cairo trading shift
    const isSameCairoDay = (isoDateString?: string): boolean => {
      if (!isoDateString) return false;
      const d = new Date(isoDateString);
      const now = new Date();
      const dStr = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      const nowStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      return dStr === nowStr;
    };

    const staleCompletedIds: string[] = [];

    const mapped = data.map((item: Record<string, unknown>) => {
      const completedAtStr = item.completed_at ? String(item.completed_at) : undefined;
      const isCompletedToday = Boolean(item.is_completed) && isSameCairoDay(completedAtStr);

      // If marked completed on a prior date, queue for automated daily rollover
      if (item.is_completed && !isCompletedToday) {
        staleCompletedIds.push(String(item.id));
      }

      return {
        id: String(item.id),
        checklistId: String(item.checklist_code || 'c-1'),
        title: String(item.title),
        description: item.description ? String(item.description) : undefined,
        dueTime: String(item.due_time || '12:00'),
        priority: (item.priority as ChecklistItem['priority']) || 'HIGH',
        mandatory: Boolean(item.mandatory),
        isCompleted: isCompletedToday,
        completedBy: isCompletedToday && item.completed_by ? String(item.completed_by) : undefined,
        completedByName: isCompletedToday && item.completed_by_name ? String(item.completed_by_name) : undefined,
        completedAt: isCompletedToday ? completedAtStr : undefined,
        reopenedBy: isCompletedToday && item.reopened_by ? String(item.reopened_by) : undefined,
        reopenedByName: isCompletedToday && item.reopened_by_name ? String(item.reopened_by_name) : undefined,
        reopenedAt: isCompletedToday && item.reopened_at ? String(item.reopened_at) : undefined,
        reopenReason: isCompletedToday && item.reopen_reason ? String(item.reopen_reason) : undefined,
      };
    });

    // Asynchronously perform automated shift reset in PostgreSQL for stale items
    if (staleCompletedIds.length > 0) {
      supabase
        .from('checklists')
        .update({
          is_completed: false,
          completed_at: null,
          completed_by_name: null,
          reopened_at: null,
          reopened_by_name: null,
          reopen_reason: null,
        })
        .in('id', staleCompletedIds)
        .then(() => {
          console.log(`Auto-reset ${staleCompletedIds.length} checklist items for new daily operational shift.`);
        })
        .catch((err) => {
          console.warn('Daily shift auto-reset notice:', err);
        });
    }

    return mapped;
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
        reopened_by_name: userName,
        reopened_at: new Date().toISOString(),
        reopen_reason: reason,
      })
      .eq('id', id);
  } catch (err) {
    console.warn('Checklist repository reopen notice:', err);
  }
}
