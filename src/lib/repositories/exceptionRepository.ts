// Exception Repository - Database Persistence Layer for Operational Exceptions
// REMEDIATION EX-1: JOIN uploaded_files to resolve file_name (column does not exist on exceptions table)

import { getDbClient } from '../db-client';
import { ExceptionRecord } from '../types';

export async function insertExceptionsBatch(exceptions: ExceptionRecord[]): Promise<number> {
  if (exceptions.length === 0) return 0;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const dbRows = exceptions.map((ex) => ({
    file_id: ex.fileId && UUID_REGEX.test(ex.fileId) ? ex.fileId : null,
    exception_type: ex.exceptionType,
    error_message: ex.errorMessage,
    raw_payload: ex.rawPayload || null,
    status: ex.status || 'OPEN',
    created_at: ex.createdAt || new Date().toISOString(),
  }));

  try {
    const supabase = await getDbClient();
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
    const supabase = await getDbClient();
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

export async function resolveExceptionInDb(id: string, resolvedBy?: string): Promise<boolean> {
  try {
    const supabase = await getDbClient();
    const { error } = await supabase
      .from('exceptions')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy || null,
      })
      .eq('id', id);

    return !error;
  } catch (err) {
    console.warn('Resolve exception error:', err);
    return false;
  }
}

export async function resolveAllExceptionsInDb(resolvedBy?: string): Promise<boolean> {
  try {
    const supabase = await getDbClient();
    const { error } = await supabase
      .from('exceptions')
      .update({
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy || null,
      })
      .eq('status', 'OPEN');

    return !error;
  } catch (err) {
    console.warn('Resolve all exceptions error:', err);
    return false;
  }
}
