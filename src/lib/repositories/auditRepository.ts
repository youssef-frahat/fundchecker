// Audit Repository - Immutable Audit Trail Database Persistence

import { getDbClient } from '../db-client';
import { AuditLog } from '../types';

export async function insertAuditLog(log: AuditLog): Promise<void> {
  try {
    const supabase = await getDbClient();
    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: log.userId && log.userId.includes('-') ? log.userId : null,
        action: log.action,
        entity_name: log.entityName,
        entity_id: log.entityId && log.entityId.includes('-') ? log.entityId : null,
        old_values: log.oldValues || null,
        new_values: log.newValues || null,
        ip_address: log.ipAddress || '127.0.0.1',
        created_at: log.timestampUtc || new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn('Audit repository insert notice:', error.message);
    }
  } catch (err) {
    console.warn('Audit log write notice:', err);
  }
}

export async function insertAuditLogsBatch(logs: AuditLog[]): Promise<void> {
  if (logs.length === 0) return;

  const dbRows = logs.map((log) => ({
    user_id: log.userId && log.userId.includes('-') ? log.userId : null,
    action: log.action,
    entity_name: log.entityName,
    entity_id: log.entityId && log.entityId.includes('-') ? log.entityId : null,
    old_values: log.oldValues || null,
    new_values: log.newValues || null,
    ip_address: log.ipAddress || '127.0.0.1',
    created_at: log.timestampUtc || new Date().toISOString(),
  }));

  try {
    const supabase = await getDbClient();
    const { error } = await supabase.from('audit_logs').insert(dbRows);
    if (error) {
      console.warn('Audit logs batch insert notice:', error.message);
    }
  } catch (err) {
    console.warn('Audit logs batch write notice:', err);
  }
}

export async function fetchAuditLogs(limit: number = 200): Promise<AuditLog[]> {
  try {
    const supabase = await getDbClient();
    const [{ data, error }, { data: users }] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('users')
        .select('id, full_name, email'),
    ]);

    if (error || !data) return [];

    const userMap = new Map<string, string>();
    if (users) {
      for (const u of users) {
        userMap.set(String(u.id), u.full_name || u.email);
      }
    }

    return data.map((item: Record<string, unknown>) => {
      const uId = item.user_id ? String(item.user_id) : '';
      const newVals = (item.new_values as Record<string, unknown>) || undefined;
      const oldVals = (item.old_values as Record<string, unknown>) || undefined;

      let resolvedName =
        userMap.get(uId) ||
        (newVals?.userName ? String(newVals.userName) : undefined) ||
        (newVals?.user_name ? String(newVals.user_name) : undefined) ||
        (newVals?.fullName ? String(newVals.fullName) : undefined) ||
        (uId ? 'User ' + uId.slice(0, 8) : undefined);

      if (!resolvedName) {
        resolvedName = 'ahmedsayed (Super Admin)';
      }

      return {
        id: String(item.id),
        userId: uId || 'system',
        userName: resolvedName,
        action: String(item.action),
        entityName: String(item.entity_name),
        entityId: item.entity_id ? String(item.entity_id) : undefined,
        oldValues: oldVals,
        newValues: newVals,
        ipAddress: String(item.ip_address || '127.0.0.1'),
        timestampUtc: String(item.created_at),
      };
    });
  } catch (err) {
    console.warn('Audit repository fetch notice:', err);
    return [];
  }
}
