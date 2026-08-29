// Trade Repository - Database Persistence Layer for Uploaded Files & Transactions
// REMEDIATION: PROC-2 (throw on DB failure), PROC-6 (UUID validation), PROC-1 (deleteTransactionsByFileId)

import { getDbClient } from '../db-client';
import { RawTransactionRow, UploadedFileRecord } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export interface SaveFileRecordDTO {
  id?: string;
  fileName: string;
  fileHashSha256: string;
  fileSize: number;
  rowCount: number;
  uploadedBy?: string;
  fileCategory?: 'ORDERS' | 'ALLOCATION';
  status: 'PROCESSING' | 'PARSED' | 'EXCEPTION' | 'FAILED' | 'APPROVED' | 'ARCHIVED';
}

export async function checkDuplicateFileHash(
  fileHashSha256: string,
  excludeFileId?: string
): Promise<UploadedFileRecord | null> {
  try {
    const supabase = await getDbClient();
    let query = supabase
      .from('uploaded_files')
      .select('*')
      .eq('file_hash_sha256', fileHashSha256)
      .neq('status', 'FAILED');

    if (excludeFileId && isValidUUID(excludeFileId)) {
      query = query.neq('id', excludeFileId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: String(data.id),
      fileName: String(data.file_name),
      fileHashSha256: String(data.file_hash_sha256),
      fileSize: Number(data.file_size),
      rowCount: Number(data.row_count),
      uploadedBy: data.uploaded_by ? String(data.uploaded_by) : 'system',
      uploadedByName: 'System User',
      uploadedAt: String(data.uploaded_at),
      status: data.status as UploadedFileRecord['status'],
    };
  } catch (err) {
    console.warn('Repository query checkDuplicateFileHash notice:', err);
    return null;
  }
}

/**
 * PROC-2 REMEDIATION: Throws on database failure — never returns a fake local ID.
 * A file record that does not exist in the database must not proceed through the pipeline.
 */
export async function insertUploadedFileRecord(fileDto: SaveFileRecordDTO): Promise<string> {
  const uploadedBy = fileDto.uploadedBy && isValidUUID(fileDto.uploadedBy) ? fileDto.uploadedBy : null;
  const supabase = await getDbClient();

  // If a file with this hash already exists (e.g. user clicked "Proceed & Overwrite Version"),
  // clean up previous child records and update existing file record
  const { data: existingFile } = await supabase
    .from('uploaded_files')
    .select('id, status')
    .eq('file_hash_sha256', fileDto.fileHashSha256)
    .maybeSingle();

  if (existingFile && isValidUUID(existingFile.id)) {
    // Delete orphan previous transactions and exceptions
    await supabase.from('transactions').delete().eq('file_id', existingFile.id);
    await supabase.from('exceptions').delete().eq('file_id', existingFile.id);

    const { data: updated, error: updateErr } = await supabase
      .from('uploaded_files')
      .update({
        file_name: fileDto.fileName,
        file_size: fileDto.fileSize,
        row_count: fileDto.rowCount,
        uploaded_by: uploadedBy,
        file_category: fileDto.fileCategory || 'ORDERS',
        status: fileDto.status,
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', existingFile.id)
      .select('id')
      .single();

    if (!updateErr && updated) {
      return String(updated.id);
    }
  }

  const { data, error } = await supabase
    .from('uploaded_files')
    .insert([
      {
        file_name: fileDto.fileName,
        file_hash_sha256: fileDto.fileHashSha256,
        file_size: fileDto.fileSize,
        row_count: fileDto.rowCount,
        uploaded_by: uploadedBy,
        file_category: fileDto.fileCategory || 'ORDERS',
        status: fileDto.status,
      },
    ])
    .select('id')
    .single();

  if (error || !data) {
    // PROC-2: Never fall through with a fake ID — throw immediately
    throw new Error(
      `Database failure: Cannot create uploaded_files record for "${fileDto.fileName}". ` +
      `Details: ${error?.message || 'No data returned from insert.'}`
    );
  }

  const returnedId = String(data.id);
  if (!isValidUUID(returnedId)) {
    throw new Error(`Database returned invalid file ID format: "${returnedId}". Aborting pipeline.`);
  }

  return returnedId;
}

export async function updateUploadedFileStatus(
  fileId: string,
  status: 'PROCESSING' | 'PARSED' | 'EXCEPTION' | 'FAILED' | 'APPROVED' | 'ARCHIVED'
): Promise<void> {
  if (!isValidUUID(fileId)) {
    console.error(`updateUploadedFileStatus: invalid fileId "${fileId}" — skipping DB update`);
    return;
  }
  try {
    const supabase = await getDbClient();
    const { error } = await supabase.from('uploaded_files').update({ status }).eq('id', fileId);
    if (error) {
      console.error(`updateUploadedFileStatus error for ${fileId}:`, error.message);
    }
  } catch (err) {
    console.error('DB updateUploadedFileStatus error:', err);
  }
}

/**
 * PROC-1 REMEDIATION: Deletes orphaned transactions created before a pipeline failure.
 * Called by the rollback error boundary in processingEngine.ts.
 */
export async function deleteTransactionsByFileId(fileId: string): Promise<void> {
  if (!isValidUUID(fileId)) {
    console.error(`deleteTransactionsByFileId: invalid fileId "${fileId}" — skipping rollback delete`);
    return;
  }
  try {
    const supabase = await getDbClient();
    const { error } = await supabase.from('transactions').delete().eq('file_id', fileId);
    if (error) {
      console.error(`Rollback deleteTransactionsByFileId error for ${fileId}:`, error.message);
    }
  } catch (err) {
    console.error('Rollback deleteTransactionsByFileId exception:', err);
  }
}

/**
 * PROC-5 REMEDIATION: Throws on batch insert failure — pipeline does not continue with partial data.
 */
export async function insertTransactionsBatch(
  fileId: string,
  transactions: RawTransactionRow[],
  batchSize: number = 500
): Promise<number> {
  if (transactions.length === 0) return 0;

  if (!isValidUUID(fileId)) {
    throw new Error(`insertTransactionsBatch: invalid fileId "${fileId}". Aborting.`);
  }

  const supabase = await getDbClient();
  let insertedCount = 0;

  for (let i = 0; i < transactions.length; i += batchSize) {
    const chunk = transactions.slice(i, i + batchSize);
    const dbRows = chunk.map((t) => ({
      file_id: fileId,
      request_id: t.requestId,
      mubasher_no: t.mubasherNo,
      customer_name: t.customerName,
      order_side: t.orderSide.toUpperCase(),
      symbol: t.symbol,
      symbol_description: t.symbolDescription,
      quantity: t.quantity,
      price: t.price,
      order_value: t.orderValue,
      total_commission: t.totalCommission || 0,
      net_settle: t.netSettle ?? t.orderValue,
      cash_account_no: t.cashAccountNo || null,
      isin_code: t.isinCode || null,
      order_date: t.orderDate || new Date().toISOString(),
    }));

    const { error } = await supabase.from('transactions').insert(dbRows);
    if (error) {
      // PROC-5: Throw on batch failure — do not continue with partial persistence
      throw new Error(
        `Transaction batch insert failed at batch ${Math.floor(i / batchSize)} (rows ${i}–${i + chunk.length - 1}): ` +
        error.message
      );
    }
    insertedCount += chunk.length;
  }

  return insertedCount;
}

/**
 * Fetches all uploaded file records from Supabase PostgreSQL.
 * Real DB records only.
 */
export async function fetchUploadedFilesFromDb(): Promise<UploadedFileRecord[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((f: Record<string, unknown>) => ({
      id: String(f.id),
      fileName: String(f.file_name),
      fileHashSha256: String(f.file_hash_sha256),
      fileSize: Number(f.file_size),
      rowCount: Number(f.row_count),
      uploadedBy: f.uploaded_by ? String(f.uploaded_by) : 'system',
      uploadedByName: 'Operations User',
      uploadedAt: String(f.uploaded_at),
      status: f.status as UploadedFileRecord['status'],
      fileCategory: (f.file_category as 'ORDERS' | 'ALLOCATION') || 'ORDERS',
    }));
  } catch (err) {
    console.warn('Repository query fetchUploadedFilesFromDb notice:', err);
    return [];
  }
}

