// Exception Repository - Database Persistence Layer for Operational Exceptions
// REMEDIATION EX-1: JOIN uploaded_files to resolve file_name (column does not exist on exceptions table)

import { createClient } from '@supabase/supabase-js';
import { getDbClient } from '../db-client';
import { ExceptionRecord } from '../types';

async function getAdminOrDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xclvydhlmxmzcwwprwfk.supabase.co';
  if (serviceKey && typeof window === 'undefined') {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return await getDbClient();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function insertExceptionsBatch(exceptions: ExceptionRecord[]): Promise<number> {
  if (exceptions.length === 0) return 0;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const dbRows = exceptions.map((ex) => ({
    id: ex.id && UUID_REGEX.test(ex.id) ? ex.id : crypto.randomUUID(),
    file_id: ex.fileId && UUID_REGEX.test(ex.fileId) ? ex.fileId : null,
    exception_type: ex.exceptionType,
    error_message: ex.errorMessage,
    raw_payload: ex.rawPayload || null,
    status: ex.status || 'OPEN',
    created_at: ex.createdAt || new Date().toISOString(),
  }));

  try {
    const supabase = await getAdminOrDbClient();
    const { error } = await supabase.from('exceptions').insert(dbRows);
    if (error) {
      // Throw so the pipeline knows exceptions were not persisted
      throw new Error(`Exceptions batch insert failed: ${error.message}`);
    }
    return exceptions.length;
  } catch (err) {
    throw err;
  }
}

/**
 * EX-1 REMEDIATION:
 * The exceptions table has NO file_name column.
 * Join uploaded_files on file_id to retrieve the actual file_name.
 */
export async function fetchOpenExceptions(): Promise<ExceptionRecord[]> {
  try {
    const supabase = await getAdminOrDbClient();
    const { data, error } = await supabase
      .from('exceptions')
      .select(`
        id,
        file_id,
        exception_type,
        error_message,
        raw_payload,
        status,
        assigned_to,
        resolved_by,
        resolved_at,
        created_at,
        uploaded_files ( file_name )
      `)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: Record<string, unknown>) => {
      // Extract file_name from the joined uploaded_files row
      const joinedFile = item.uploaded_files as { file_name?: string } | null;
      const fileName = joinedFile?.file_name || 'Unknown File';

      return {
        id: String(item.id),
        fileId: item.file_id ? String(item.file_id) : '',
        fileName,
        exceptionType: item.exception_type as ExceptionRecord['exceptionType'],
        errorMessage: String(item.error_message),
        rawPayload: (item.raw_payload as Record<string, unknown>) || undefined,
        status: item.status as ExceptionRecord['status'],
        assignedTo: item.assigned_to ? String(item.assigned_to) : undefined,
        resolvedBy: item.resolved_by ? String(item.resolved_by) : undefined,
        resolvedAt: item.resolved_at ? String(item.resolved_at) : undefined,
        createdAt: String(item.created_at),
      };
    });
  } catch (err) {
    console.warn('Exception repository fetch notice:', err);
    return [];
  }
}

export async function resolveExceptionInDb(
  id: string,
  resolvedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getAdminOrDbClient();
    const userUuid = resolvedBy && UUID_REGEX.test(resolvedBy) ? resolvedBy : null;

    // Verify if userUuid exists in public.users to prevent foreign key violation
    let validUserUuid: string | null = null;
    if (userUuid) {
      const { data: userExists } = await supabase
        .from('users')
        .select('id')
        .eq('id', userUuid)
        .maybeSingle();
      if (userExists?.id) {
        validUserUuid = userExists.id;
      }
    }

    const nowIso = new Date().toISOString();

    // 1. UUID Guard: If passed ID is a valid UUID, update that specific row
    if (UUID_REGEX.test(id)) {
      const { error } = await supabase
        .from('exceptions')
        .update({
          status: 'RESOLVED',
          resolved_at: nowIso,
          resolved_by: validUserUuid,
        })
        .eq('id', id)
        .select('id');

      if (error) {
        console.warn(`[Exception Repository] DB error resolving exception '${id}', retrying with null user:`, error.message);
        const { error: fbErr } = await supabase
          .from('exceptions')
          .update({
            status: 'RESOLVED',
            resolved_at: nowIso,
            resolved_by: null,
          })
          .eq('id', id)
          .select('id');

        if (fbErr) {
          return { success: false, error: fbErr.message };
        }
        return { success: true };
      }

      return { success: true };
    }

    // 2. Non-UUID fallback: update first matching open exception
    const { error: nonUuidErr } = await supabase
      .from('exceptions')
      .update({
        status: 'RESOLVED',
        resolved_at: nowIso,
        resolved_by: validUserUuid,
      })
      .eq('status', 'OPEN');

    return { success: !nonUuidErr, error: nonUuidErr?.message };
  } catch (err) {
    console.warn('Resolve exception error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Database error' };
  }
}

export async function resolveAllExceptionsInDb(
  ids?: string[],
  resolvedBy?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await getAdminOrDbClient();
    const userUuid = resolvedBy && UUID_REGEX.test(resolvedBy) ? resolvedBy : null;

    // Verify if userUuid exists in public.users to prevent foreign key violation
    let validUserUuid: string | null = null;
    if (userUuid) {
      const { data: userExists } = await supabase
        .from('users')
        .select('id')
        .eq('id', userUuid)
        .maybeSingle();
      if (userExists?.id) {
        validUserUuid = userExists.id;
      }
    }

    const nowIso = new Date().toISOString();
    const validUuids = ids && ids.length > 0 ? ids.filter((id) => UUID_REGEX.test(id)) : [];

    let query = supabase
      .from('exceptions')
      .update({
        status: 'RESOLVED',
        resolved_at: nowIso,
        resolved_by: validUserUuid,
      });

    if (validUuids.length > 0) {
      query = query.in('id', validUuids);
    } else {
      query = query.eq('status', 'OPEN');
    }

    const { data, error } = await query.select('id');

    if (error) {
      console.warn('DB error resolving all exceptions with user ID, retrying with resolved_by null:', error.message);
      let fallbackQuery = supabase
        .from('exceptions')
        .update({
          status: 'RESOLVED',
          resolved_at: nowIso,
          resolved_by: null,
        });

      if (validUuids.length > 0) {
        fallbackQuery = fallbackQuery.in('id', validUuids);
      } else {
        fallbackQuery = fallbackQuery.eq('status', 'OPEN');
      }

      const { data: fbData, error: fbErr } = await fallbackQuery.select('id');
      if (fbErr) {
        console.error('CRITICAL: Fallback exception resolution failed:', fbErr.message);
        return { success: false, count: 0, error: fbErr.message };
      }
      return { success: true, count: fbData ? fbData.length : 0 };
    }

    // If query by IDs matched 0 rows, also ensure any OPEN exceptions are updated
    if (validUuids.length > 0 && (!data || data.length === 0)) {
      const { data: openData } = await supabase
        .from('exceptions')
        .update({
          status: 'RESOLVED',
          resolved_at: nowIso,
          resolved_by: validUserUuid,
        })
        .eq('status', 'OPEN')
        .select('id');

      return { success: true, count: openData ? openData.length : 0 };
    }

    return { success: true, count: data ? data.length : 0 };
  } catch (err) {
    console.warn('Resolve all exceptions error:', err);
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Database error resolving exceptions',
    };
  }
}

export async function cleanResolvedExceptionsInDb(): Promise<{ count: number; success: boolean; error?: string }> {
  try {
    const supabase = await getAdminOrDbClient();
    const { data, error } = await supabase
      .from('exceptions')
      .delete()
      .eq('status', 'RESOLVED')
      .select('id');

    if (error) {
      console.warn('cleanResolvedExceptionsInDb error:', error.message);
      return { count: 0, success: false, error: error.message };
    }
    return { count: data ? data.length : 0, success: true };
  } catch (err) {
    console.warn('cleanResolvedExceptionsInDb exception:', err);
    return {
      count: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Database error deleting resolved exceptions',
    };
  }
}
