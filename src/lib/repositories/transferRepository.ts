// Transfer Repository - Database Persistence Layer for Transfer Sheet Drafts, Lines & Adjustments
// Implements: System Net Transfer, Adjustment Amount, Adjustment Category, and Final Transfer Amount

import { getDbClient } from '../db-client';
import { AdjustmentCategory, TransferLineAdjustment, TransferSheetBatch, TransferSheetLine } from '../types';

export async function createTransferBatchWithLines(
  batchData: Omit<TransferSheetBatch, 'id' | 'createdAt' | 'updatedAt'>,
  linesData: Omit<TransferSheetLine, 'id'>[]
): Promise<string> {
  const supabase = await getDbClient();

  // 1. Insert Batch Header
  const { data: batch, error: batchErr } = await supabase
    .from('transfer_sheet_batches')
    .insert([
      {
        batch_number: batchData.batchNumber,
        allocation_file_id: batchData.allocationFileId,
        business_date: batchData.businessDate,
        status: batchData.status || 'DRAFT',
        total_buy_amount: batchData.totalBuyAmount,
        total_sell_amount: batchData.totalSellAmount,
        total_net_amount: batchData.totalNetAmount,
        maker_id: batchData.makerId,
      },
    ])
    .select('id')
    .single();

  if (batchErr || !batch) {
    throw new Error(
      `[DB ERROR] createTransferBatchWithLines: Failed to insert transfer_sheet_batches record. ` +
      `Details: ${batchErr?.message || 'No batch record returned.'}`
    );
  }

  const batchId = String(batch.id);

  // 2. Insert Lines Batch
  const dbLines = linesData.map((l) => ({
    batch_id: batchId,
    symbol_code: l.symbolCode,
    symbol_name: l.symbolName,
    actual_symbol: l.actualSymbol,

    system_buy_amount: l.systemBuyAmount,
    system_sell_amount: l.systemSellAmount,
    adjustment_amount: l.adjustmentAmount || 0,
    is_manually_adjusted: false,
  }));

  const { error: linesErr } = await supabase.from('transfer_sheet_lines').insert(dbLines);
  if (linesErr) {
    throw new Error(
      `[DB ERROR] createTransferBatchWithLines: Failed to insert ${dbLines.length} transfer_sheet_lines for batch ${batchId}. ` +
      `Details: ${linesErr.message}`
    );
  }

  return batchId;
}


export async function fetchLatestTransferBatch(): Promise<TransferSheetBatch | null> {
  try {
    const supabase = await getDbClient();
    const { data: batch, error: batchErr } = await supabase
      .from('transfer_sheet_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batchErr || !batch) return null;

    // Fetch lines for this batch
    const { data: lines } = await supabase
      .from('transfer_sheet_lines')
      .select('*')
      .eq('batch_id', batch.id)
      .order('symbol_code', { ascending: true });

    // Fetch adjustments for this batch
    const { data: adjustments } = await supabase
      .from('transfer_line_adjustments')
      .select('*')
      .eq('batch_id', batch.id)
      .order('timestamp_utc', { ascending: false });

    const adjustmentsMap = new Map<string, TransferLineAdjustment[]>();
    if (adjustments) {
      for (const adj of adjustments) {
        const lineId = String(adj.line_id);
        if (!adjustmentsMap.has(lineId)) adjustmentsMap.set(lineId, []);
        adjustmentsMap.get(lineId)!.push({
          id: String(adj.id),
          batchId: String(adj.batch_id),
          lineId,
          symbolCode: String(adj.symbol_code),
          systemNetSnapshot: Number(adj.system_net_snapshot) || 0,
          oldAdjustmentAmount: Number(adj.old_adjustment_amount) || 0,
          newAdjustmentAmount: Number(adj.new_adjustment_amount) || 0,
          delta: Number(adj.delta) || 0,
          resultingFinalTransfer: Number(adj.resulting_final_transfer) || 0,
          adjustmentCategory: (adj.adjustment_category || 'MANUAL_ADJUSTMENT') as AdjustmentCategory,
          reason: String(adj.reason),
          userId: String(adj.user_id),
          userName: String(adj.user_name),
          clientIp: String(adj.client_ip),
          timestampUtc: String(adj.timestamp_utc),
        });
      }
    }

interface DbTransferLine {
  id: unknown;
  batch_id: unknown;
  symbol_code: unknown;
  symbol_name: unknown;
  actual_symbol?: unknown;
  system_buy_amount?: unknown;
  system_sell_amount?: unknown;
  adjustment_amount?: unknown;
  adjustment_category?: unknown;
  adjustment_reason?: unknown;
  is_manually_adjusted?: unknown;
}

    const mappedLines: TransferSheetLine[] = (lines || []).map((item) => {
      const l = item as unknown as DbTransferLine;
      const sysBuy = Number(l.system_buy_amount) || 0;
      const sysSell = Number(l.system_sell_amount) || 0;
      const sysNet = sysSell - sysBuy;
      const adjAmount = Number(l.adjustment_amount) || 0;
      const finalTransfer = sysNet + adjAmount;

      return {
        id: String(l.id),
        batchId: String(l.batch_id),
        symbolCode: String(l.symbol_code),
        symbolName: String(l.symbol_name),
        actualSymbol: l.actual_symbol ? String(l.actual_symbol) : undefined,
        systemBuyAmount: sysBuy,
        systemSellAmount: sysSell,
        systemNetAmount: sysNet,
        adjustmentAmount: adjAmount,
        adjustmentCategory: l.adjustment_category as AdjustmentCategory | undefined,
        adjustmentReason: l.adjustment_reason ? String(l.adjustment_reason) : undefined,
        finalTransferAmount: finalTransfer,
        isManuallyAdjusted: Boolean(l.is_manually_adjusted) || adjAmount !== 0,
        adjustments: adjustmentsMap.get(String(l.id)) || [],
      };
    });

    return {
      id: String(batch.id),
      batchNumber: String(batch.batch_number),
      allocationFileId: String(batch.allocation_file_id),
      businessDate: String(batch.business_date),
      status: batch.status as TransferSheetBatch['status'],
      totalBuyAmount: Number(batch.total_buy_amount) || 0,
      totalSellAmount: Number(batch.total_sell_amount) || 0,
      totalNetAmount: Number(batch.total_net_amount) || 0,
      makerId: String(batch.maker_id),
      checkerId: batch.checker_id ? String(batch.checker_id) : undefined,
      rejectionReason: batch.rejection_reason ? String(batch.rejection_reason) : undefined,
      approvedAt: batch.approved_at ? String(batch.approved_at) : undefined,
      lockedAt: batch.locked_at ? String(batch.locked_at) : undefined,
      createdAt: String(batch.created_at),
      updatedAt: String(batch.updated_at),
      lines: mappedLines,
    };
  } catch (err) {
    console.warn('Repository query fetchLatestTransferBatch notice:', err);
    return null;
  }
}

export async function recordTransferLineAdjustment(
  batchId: string,
  lineId: string,
  symbolCode: string,
  systemNetSnapshot: number,
  oldAdjustmentAmount: number,
  newAdjustmentAmount: number,
  adjustmentCategory: AdjustmentCategory,
  reason: string,
  userId: string,
  userName: string,
  clientIp: string = '127.0.0.1'
): Promise<boolean> {
  const supabase = await getDbClient();

  // 1. Update line adjustment amount and category
  const { error: lineErr } = await supabase
    .from('transfer_sheet_lines')
    .update({
      adjustment_amount: newAdjustmentAmount,
      adjustment_category: adjustmentCategory,
      adjustment_reason: reason,
      is_manually_adjusted: newAdjustmentAmount !== 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lineId);

  if (lineErr) {
    console.warn('DB error updating transfer_sheet_line:', lineErr.message);
    return false;
  }

  // 2. Insert Immutable Audit Log
  const { error: adjErr } = await supabase.from('transfer_line_adjustments').insert([
    {
      batch_id: batchId,
      line_id: lineId,
      symbol_code: symbolCode,
      system_net_snapshot: systemNetSnapshot,
      old_adjustment_amount: oldAdjustmentAmount,
      new_adjustment_amount: newAdjustmentAmount,
      resulting_final_transfer: systemNetSnapshot + newAdjustmentAmount,
      adjustment_category: adjustmentCategory,
      reason,
      user_id: userId,
      user_name: userName,
      client_ip: clientIp,
    },
  ]);

  if (adjErr) {
    console.warn('DB error inserting transfer_line_adjustment:', adjErr.message);
  }

  // 3. Update batch status to MODIFIED
  await supabase
    .from('transfer_sheet_batches')
    .update({ status: 'MODIFIED', updated_at: new Date().toISOString() })
    .eq('id', batchId);

  return true;
}

export async function updateBatchStatusInDb(
  batchId: string,
  status: TransferSheetBatch['status'],
  checkerId?: string,
  rejectionReason?: string
): Promise<boolean> {
  const supabase = await getDbClient();
  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (checkerId) {
    payload.checker_id = checkerId;
  }
  if (status === 'APPROVED' || status === 'LOCKED') {
    payload.approved_at = new Date().toISOString();
    payload.locked_at = new Date().toISOString();
  }
  if (rejectionReason) {
    payload.rejection_reason = rejectionReason;
  }

  const { error } = await supabase.from('transfer_sheet_batches').update(payload).eq('id', batchId);
  return !error;
}
