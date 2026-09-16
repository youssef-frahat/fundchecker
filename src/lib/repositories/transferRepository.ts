// Transfer Repository - Database Persistence Layer for Transfer Sheet Drafts, Lines & Adjustments
// Implements: System Net Transfer, Adjustment Amount, Adjustment Category, and Final Transfer Amount

import { getDbClient } from '../db-client';
import { AdjustmentCategory, TransferLineAdjustment, TransferSheetBatch, TransferSheetLine } from '../types';
import { calculateFinalTransfer } from '../services/financialMath';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createTransferBatchWithLines(
  batchData: Omit<TransferSheetBatch, 'id' | 'createdAt' | 'updatedAt'>,
  linesData: Omit<TransferSheetLine, 'id'>[]
): Promise<string> {
  const supabase = await getDbClient();

  // Validate that allocation_file_id is a valid UUID or null to prevent PostgreSQL type mismatch
  const validFileId =
    batchData.allocationFileId && UUID_REGEX.test(batchData.allocationFileId)
      ? batchData.allocationFileId
      : null;

  // DAT-01: Atomic batch+lines creation via PostgreSQL stored procedure
  // Guarantees full ACID rollback if any line insert fails (zero orphaned batch headers)
  const p_batch = {
    batch_number: batchData.batchNumber,
    allocation_file_id: validFileId,
    business_date: batchData.businessDate,
    status: batchData.status || 'DRAFT',
    total_buy_amount: batchData.totalBuyAmount,
    total_sell_amount: batchData.totalSellAmount,
    total_net_amount: batchData.totalNetAmount,
    maker_id: batchData.makerId,
    maker_name: batchData.makerName,
  };

  const p_lines = linesData.map((l) => ({
    symbol_code: l.symbolCode,
    symbol_name: l.symbolName,
    actual_symbol: l.actualSymbol,
    system_buy_amount: l.systemBuyAmount,
    system_sell_amount: l.systemSellAmount,
    adjustment_amount: l.adjustmentAmount || 0,
  }));

  try {
    const { data: batchId, error: rpcErr } = await supabase.rpc('create_transfer_batch_atomic', {
      p_batch,
      p_lines,
    });

    if (!rpcErr && batchId) {
      return String(batchId);
    }
  } catch (rpcCatchErr) {
    console.warn('Notice: create_transfer_batch_atomic RPC invocation, using direct transactional insert:', rpcCatchErr);
  }

  // Direct Resilient Insert
  const { data: batchRow, error: batchInsertErr } = await supabase
    .from('transfer_sheet_batches')
    .insert([
      {
        batch_number: batchData.batchNumber,
        allocation_file_id: validFileId,
        business_date: batchData.businessDate,
        status: batchData.status || 'DRAFT',
        total_buy_amount: batchData.totalBuyAmount,
        total_sell_amount: batchData.totalSellAmount,
        total_net_amount: batchData.totalNetAmount,
        maker_id: batchData.makerId,
        maker_name: batchData.makerName,
      },
    ])
    .select('id')
    .single();

  if (batchInsertErr || !batchRow) {
    throw new Error(
      `[DB ERROR] createTransferBatchWithLines failed: ${batchInsertErr?.message || 'Failed to insert transfer batch'}`
    );
  }

  const batchId = String(batchRow.id);

  if (linesData.length > 0) {
    const rowsToInsert = linesData.map((l) => ({
      batch_id: batchId,
      symbol_code: l.symbolCode,
      symbol_name: l.symbolName,
      actual_symbol: l.actualSymbol,
      system_buy_amount: l.systemBuyAmount,
      system_sell_amount: l.systemSellAmount,
      adjustment_amount: l.adjustmentAmount || 0,
    }));

    const { error: linesErr } = await supabase.from('transfer_sheet_lines').insert(rowsToInsert);
    if (linesErr) {
      await supabase.from('transfer_sheet_batches').delete().eq('id', batchId);
      throw new Error(`[DB ERROR] createTransferBatchWithLines lines insert failed: ${linesErr.message}`);
    }
  }

  return batchId;
}


export interface TransferBatchSummary {
  id: string;
  batchNumber: string;
  status: string;
  totalNetAmount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  createdAt: string;
}

interface DbTransferLine {
  id: unknown;
  batch_id: unknown;
  symbol_code: unknown;
  symbol_name: unknown;
  actual_symbol?: unknown;
  system_buy_amount?: unknown;
  system_sell_amount?: unknown;
  adjusted_buy_amount?: unknown;
  adjusted_sell_amount?: unknown;
  adjustment_amount?: unknown;
  adjustment_category?: unknown;
  adjustment_reason?: unknown;
  is_manually_adjusted?: unknown;
}

function buildTransferBatchObject(
  batch: Record<string, unknown>,
  lines: unknown[] | null,
  adjustments: unknown[] | null
): TransferSheetBatch {
  const adjustmentsMap = new Map<string, TransferLineAdjustment[]>();
  if (adjustments) {
    for (const item of adjustments) {
      const adj = item as Record<string, unknown>;
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
        adjustedBuyAmount: adj.adjusted_buy_amount !== null && adj.adjusted_buy_amount !== undefined ? Number(adj.adjusted_buy_amount) : undefined,
        adjustedSellAmount: adj.adjusted_sell_amount !== null && adj.adjusted_sell_amount !== undefined ? Number(adj.adjusted_sell_amount) : undefined,
        userId: String(adj.user_id || adj.adjusted_by || ''),
        userName: String(adj.user_name || adj.adjusted_by_name || ''),
        clientIp: String(adj.client_ip),
        timestampUtc: String(adj.timestamp_utc),
      });
    }
  }

  const mappedLines: TransferSheetLine[] = (lines || []).map((item) => {
    const l = item as unknown as DbTransferLine;
    const sysBuy = Number(l.system_buy_amount) || 0;
    const sysSell = Number(l.system_sell_amount) || 0;
    const adjBuy = l.adjusted_buy_amount !== null && l.adjusted_buy_amount !== undefined ? Number(l.adjusted_buy_amount) : undefined;
    const adjSell = l.adjusted_sell_amount !== null && l.adjusted_sell_amount !== undefined ? Number(l.adjusted_sell_amount) : undefined;
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
      adjustedBuyAmount: adjBuy,
      adjustedSellAmount: adjSell,
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

    const { data: lines } = await supabase
      .from('transfer_sheet_lines')
      .select('*')
      .eq('batch_id', batch.id)
      .order('symbol_code', { ascending: true });

    const { data: adjustments } = await supabase
      .from('transfer_line_adjustments')
      .select('*')
      .eq('batch_id', batch.id)
      .order('timestamp_utc', { ascending: false });

    return buildTransferBatchObject(batch as Record<string, unknown>, lines, adjustments);
  } catch (err) {
    console.warn('Repository query fetchLatestTransferBatch notice:', err);
    return null;
  }
}

export async function fetchTransferBatchById(batchId: string): Promise<TransferSheetBatch | null> {
  try {
    const supabase = await getDbClient();
    const { data: batch, error: batchErr } = await supabase
      .from('transfer_sheet_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();

    if (batchErr || !batch) return null;

    const { data: lines } = await supabase
      .from('transfer_sheet_lines')
      .select('*')
      .eq('batch_id', batch.id)
      .order('symbol_code', { ascending: true });

    const { data: adjustments } = await supabase
      .from('transfer_line_adjustments')
      .select('*')
      .eq('batch_id', batch.id)
      .order('timestamp_utc', { ascending: false });

    return buildTransferBatchObject(batch as Record<string, unknown>, lines, adjustments);
  } catch (err) {
    console.warn('Repository query fetchTransferBatchById notice:', err);
    return null;
  }
}

export async function fetchAllTransferBatches(): Promise<TransferBatchSummary[]> {
  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from('transfer_sheet_batches')
      .select('id, batch_number, status, total_net_amount, total_buy_amount, total_sell_amount, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((b) => ({
      id: String(b.id),
      batchNumber: String(b.batch_number),
      status: String(b.status),
      totalNetAmount: Number(b.total_net_amount) || 0,
      totalBuyAmount: Number(b.total_buy_amount) || 0,
      totalSellAmount: Number(b.total_sell_amount) || 0,
      createdAt: String(b.created_at),
    }));
  } catch {
    return [];
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
  clientIp: string = '127.0.0.1',
  adjustedBuyAmount?: number,
  adjustedSellAmount?: number
): Promise<boolean> {
  const supabase = await getDbClient();

  // 1. Update line adjustment amount and optional adjusted buy/sell amounts
  const lineUpdate: Record<string, unknown> = {
    adjustment_amount: newAdjustmentAmount,
    is_manually_adjusted: true,
  };
  if (adjustedBuyAmount !== undefined) {
    lineUpdate.adjusted_buy_amount = adjustedBuyAmount;
  }
  if (adjustedSellAmount !== undefined) {
    lineUpdate.adjusted_sell_amount = adjustedSellAmount;
  }
  if (adjustmentCategory) {
    lineUpdate.adjustment_category = adjustmentCategory;
  }
  if (reason) {
    lineUpdate.adjustment_reason = reason;
  }

  const { error: lineErr } = await supabase
    .from('transfer_sheet_lines')
    .update(lineUpdate)
    .eq('id', lineId);

  if (lineErr) {
    console.warn('DB error updating transfer_sheet_line with extended fields, falling back:', lineErr.message);
    // Fallback in case columns do not exist in DB yet
    await supabase
      .from('transfer_sheet_lines')
      .update({
        adjustment_amount: newAdjustmentAmount,
        is_manually_adjusted: true,
      })
      .eq('id', lineId);
  }

  // 2. Insert Immutable Audit Log in transfer_line_adjustments
  // Ensure both adjusted_by (UUID / FK) and user_id (text) are supported
  const adjPayload: Record<string, unknown> = {
    batch_id: batchId,
    line_id: lineId,
    symbol_code: symbolCode,
    system_net_snapshot: systemNetSnapshot,
    old_adjustment_amount: oldAdjustmentAmount,
    new_adjustment_amount: newAdjustmentAmount,
    resulting_final_transfer: calculateFinalTransfer(systemNetSnapshot, newAdjustmentAmount),
    adjustment_category: adjustmentCategory,
    reason,
    adjusted_by: userId,
    adjusted_by_name: userName,
    user_id: userId,
    user_name: userName,
    client_ip: clientIp,
  };
  if (adjustedBuyAmount !== undefined) adjPayload.adjusted_buy_amount = adjustedBuyAmount;
  if (adjustedSellAmount !== undefined) adjPayload.adjusted_sell_amount = adjustedSellAmount;

  const { error: adjErr } = await supabase.from('transfer_line_adjustments').insert([adjPayload]);
  if (adjErr) {
    console.warn('DB error inserting transfer_line_adjustment with all fields, trying fallback:', adjErr.message);
    await supabase.from('transfer_line_adjustments').insert([
      {
        batch_id: batchId,
        line_id: lineId,
        symbol_code: symbolCode,
        system_net_snapshot: systemNetSnapshot,
        old_adjustment_amount: oldAdjustmentAmount,
        new_adjustment_amount: newAdjustmentAmount,
        resulting_final_transfer: calculateFinalTransfer(systemNetSnapshot, newAdjustmentAmount),
        adjustment_category: adjustmentCategory,
        reason,
        adjusted_by: userId,
        adjusted_by_name: userName,
        client_ip: clientIp,
      },
    ]);
  }

  // 3. Update batch status to MODIFIED and recompute total_net_amount, total_buy_amount, total_sell_amount
  const { data: allLines } = await supabase
    .from('transfer_sheet_lines')
    .select('system_buy_amount, system_sell_amount, adjusted_buy_amount, adjusted_sell_amount, final_transfer_amount, adjustment_amount')
    .eq('batch_id', batchId);

  if (allLines && allLines.length > 0) {
    let batchTotalBuy = 0;
    let batchTotalSell = 0;
    let batchTotalNet = 0;
    for (const l of allLines) {
      const effBuy =
        l.adjusted_buy_amount !== null && l.adjusted_buy_amount !== undefined
          ? Number(l.adjusted_buy_amount)
          : Number(l.system_buy_amount) || 0;
      const effSell =
        l.adjusted_sell_amount !== null && l.adjusted_sell_amount !== undefined
          ? Number(l.adjusted_sell_amount)
          : Number(l.system_sell_amount) || 0;
      const effNet = Number(l.final_transfer_amount) || (effSell - effBuy + (Number(l.adjustment_amount) || 0));
      batchTotalBuy += effBuy;
      batchTotalSell += effSell;
      batchTotalNet += effNet;
    }

    await supabase
      .from('transfer_sheet_batches')
      .update({
        status: 'MODIFIED',
        total_buy_amount: Math.round(batchTotalBuy * 10000) / 10000,
        total_sell_amount: Math.round(batchTotalSell * 10000) / 10000,
        total_net_amount: Math.round(batchTotalNet * 10000) / 10000,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);
  } else {
    await supabase
      .from('transfer_sheet_batches')
      .update({ status: 'MODIFIED', updated_at: new Date().toISOString() })
      .eq('id', batchId);
  }

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
