// Storage Service - Supabase Storage Operations for Operational Reports & Files
// REMEDIATION STG-2: upsert:false — prevents overwriting approved financial reports
// REMEDIATION STG-3: getReportSignedUrl — replaces public URL with time-limited signed URL

import { getDbClient } from '../db-client';

const BUCKET_NAME = 'reports';

export async function uploadReportToStorage(
  filePath: string,
  fileBlob: Blob,
  contentType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  try {
    const supabase = await getDbClient();
    const fileBuffer = await fileBlob.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false, // STG-2: Never overwrite existing reports — versioned paths only
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, storagePath: data.path };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Storage upload error';
    return { success: false, error: msg };
  }
}

export async function downloadReportFromStorage(
  filePath: string
): Promise<{ success: boolean; data?: Blob; error?: string }> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error || !data) {
      return { success: false, error: error?.message || 'File download failed' };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Storage download error';
    return { success: false, error: msg };
  }
}

/**
 * STG-3 REMEDIATION: Returns a time-limited signed URL (default 5 minutes).
 * Financial reports are NEVER publicly accessible — signed URLs require valid Supabase session.
 * Replaces the removed getPublicUrl which exposed reports to the public internet.
 */
export async function getReportSignedUrl(
  filePath: string,
  expiresInSeconds: number = 300
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { success: false, error: error?.message || 'Failed to generate signed URL' };
    }

    return { success: true, signedUrl: data.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signed URL generation error';
    return { success: false, error: msg };
  }
}

// REMOVED: getReportPublicUrl() — DO NOT RESTORE
// Public URLs expose financial reports to the open internet without authentication.
// Use getReportSignedUrl() for all report downloads.
