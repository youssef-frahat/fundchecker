// Processing Actions - Secure Next.js Server Action Layer

'use server';

import { headers } from 'next/headers';
import { RawTransactionRow } from '@/lib/types';
import { executeProcessingPipeline, ProcessingPipelineReport } from '@/lib/services/processingEngine';
import { getAuthenticatedServerUser } from '@/lib/supabase-server';

export async function processTradeFileAction(
  fileName: string,
  fileHashSha256: string,
  fileSize: number,
  rawRows: RawTransactionRow[],
  allowOverwrite: boolean = true
): Promise<{ success: boolean; report?: ProcessingPipelineReport; error?: string }> {
  try {
    // Authenticate Request & Extract User Identity strictly from Server Session
    const currentUser = await getAuthenticatedServerUser();
    if (!currentUser) {
      return { success: false, error: '401 Unauthorized: Valid authenticated session required.' };
    }

    if (!fileName || !fileHashSha256 || !rawRows || rawRows.length === 0) {
      return { success: false, error: 'Invalid input file data or empty rows.' };
    }

    // Extract real client IP from request headers for audit trail
    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '0.0.0.0';

    const report = await executeProcessingPipeline(
      fileName,
      fileHashSha256,
      fileSize,
      rawRows,
      currentUser.id,
      clientIp,
      allowOverwrite
    );

    return { success: true, report };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown execution failure during trade file processing.';
    return { success: false, error: errorMsg };
  }
}
