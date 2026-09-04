// TransferSheetView Component - Enterprise Cash Transfer Netting Sheet
// Enforces: System Net Transfer (Immutable) + Adjustment Amount (Category-driven) = Final Transfer Amount
// Maker-Checker 4-Eyes Principle & Immutable Audit Trail

import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Lock,
  Download,
  AlertCircle,
  Clock,
  Edit3,
  History,
  Info,
  DollarSign,
  Layers,
  ChevronRight,
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import { AdjustmentCategory, NettingRow, TransferSheetBatch, TransferSheetLine, UserRole } from '@/lib/types';
import { exportTransferSheetBatchExcel } from '@/lib/excel-engine';
import { formatUserFriendlyError } from '@/lib/error-formatter';

interface TransferSheetViewProps {
  nettingRows: NettingRow[];
  totalBuy: number;
  totalSell: number;
  totalNet: number;
  currentRole: UserRole;
  reviewStatus: 'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED';
  batch?: TransferSheetBatch | null;
  makerName?: string;
  checkerName?: string;
  allBatches?: Array<{ id: string; batchNumber: string; status: string; totalNetAmount: number; createdAt: string }>;
  onSelectBatch?: (batchId: string) => void;
  onMakerSubmit: () => void;
  onCheckerApprove: () => void;
  onNavigateToUpload?: () => void;
  onAdjustLine?: (
    lineId: string,
    symbolCode: string,
    systemNetSnapshot: number,
    oldAdjustmentAmount: number,
    newAdjustmentAmount: number,
    adjustmentCategory: AdjustmentCategory,
    reason: string
  ) => Promise<void>;
  onReviewSingleFund?: (symbolCode: string, newStatus: 'UNDER_REVIEW' | 'APPROVED') => void;
  onNewBatch?: () => void;
}

const CATEGORY_LABELS: Record<AdjustmentCategory, string> = {
  BANK_FEE: 'Bank Fee',
  SETTLEMENT_DIFFERENCE: 'Settlement Difference',
  CUSTODIAN_CORRECTION: 'Custodian Correction',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
  OTHER: 'Other',
};

function formatAccountingUI(val: number) {
  if (Math.abs(val) < 0.001) {
    return { text: '-', colorClass: 'text-slate-400 font-mono', inlineColor: 'text-slate-400' };
  }
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(val));

  if (val < 0) {
    // Negative -> RED with accounting parentheses
    return {
      text: `(${formatted})`,
      colorClass: 'text-rose-700 bg-rose-50 border border-rose-200 font-bold',
      inlineColor: 'text-rose-700 font-bold',
    };
  }
  // Positive -> GREEN
  return {
    text: formatted,
    colorClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold',
    inlineColor: 'text-emerald-700 font-bold',
  };
}

export const TransferSheetView: React.FC<TransferSheetViewProps> = ({
  nettingRows,
  currentRole,
  reviewStatus,
  batch,
  allBatches,
  onSelectBatch,
  onMakerSubmit,
  onCheckerApprove,
  onNavigateToUpload,
  onAdjustLine,
  onNewBatch,
}) => {
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EGP' | 'USD'>('ALL');

  // Adjustment Modal State
  const [editingModal, setEditingModal] = useState<{
    lineId: string;
    symbolCode: string;
    symbolName: string;
    systemNet: number;
    currentAdjustment: number;
    currentCategory: AdjustmentCategory;
  } | null>(null);

  const [adjustmentCategory, setAdjustmentCategory] = useState<AdjustmentCategory>('MANUAL_ADJUSTMENT');
  const [adjustmentAmountInput, setAdjustmentAmountInput] = useState<string>('0');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState<boolean>(false);
  const [selectedAuditHistory, setSelectedAuditHistory] = useState<TransferSheetLine | null>(null);

  const isLocked = batch?.status === 'LOCKED' || reviewStatus === 'APPROVED';
  const isPendingReview = batch?.status === 'PENDING_REVIEW' || reviewStatus === 'UNDER_REVIEW';
  const isAuditor = (currentRole as string) === 'AUDITOR';
  const canEdit = !isLocked && !isPendingReview && !isAuditor;
  const canApprove = !isLocked && ((currentRole as string) === 'OPERATIONS_CHECKER' || currentRole === 'SUPER_ADMIN');

  // Derive lines from batch if available, or fall back to processed nettingRows
  const activeLines: TransferSheetLine[] = (batch?.lines && batch.lines.length > 0)
    ? batch.lines
    : (nettingRows && nettingRows.length > 0)
    ? nettingRows.map((nr, idx) => ({
        id: `draft-line-${idx}-${nr.symbolCode}`,
        batchId: batch?.id || 'draft-batch',
        symbolCode: nr.symbolCode,
        symbolName: nr.symbolName,
        actualSymbol: nr.actualSymbol,
        systemBuyAmount: nr.buyTotal,
        systemSellAmount: nr.sellTotal,
        systemNetAmount: nr.netAmount,
        adjustmentAmount: 0,
        finalTransferAmount: nr.netAmount,
        isManuallyAdjusted: false,
        status: 'PENDING' as const,
        adjustments: [],
      }))
    : [];

  const handleOpenEditModal = (line: TransferSheetLine) => {
    setEditingModal({
      lineId: line.id,
      symbolCode: line.symbolCode,
      symbolName: line.symbolName,
      systemNet: line.systemNetAmount,
      currentAdjustment: line.adjustmentAmount || 0,
      currentCategory: line.adjustmentCategory || 'MANUAL_ADJUSTMENT',
    });
    setAdjustmentCategory(line.adjustmentCategory || 'MANUAL_ADJUSTMENT');
    setAdjustmentAmountInput(String(line.finalTransferAmount !== undefined ? line.finalTransferAmount : (line.systemNetAmount + (line.adjustmentAmount || 0))));
    setAdjustmentReason(line.adjustmentReason || '');
    setAdjustmentError(null);
  };

  const handleSaveAdjustment = async () => {
    if (!editingModal) return;
    const targetFinal = parseFloat(adjustmentAmountInput);
    if (isNaN(targetFinal)) {
      setAdjustmentError('Please enter a valid numeric transfer amount.');
      return;
    }
    if (!adjustmentReason || adjustmentReason.trim().length < 1) {
      setAdjustmentError('Mandatory justification reason is required.');
      return;
    }

    // Calculated adjustment delta to reach the target final transfer amount:
    const calculatedAdjustmentDelta = targetFinal - editingModal.systemNet;

    try {
      setIsSubmittingAdjustment(true);
      if (onAdjustLine) {
        await onAdjustLine(
          editingModal.lineId,
          editingModal.symbolCode,
          editingModal.systemNet,
          editingModal.currentAdjustment,
          calculatedAdjustmentDelta,
          adjustmentCategory,
          adjustmentReason.trim()
        );
      }
      setEditingModal(null);
    } catch (err: unknown) {
      setAdjustmentError(formatUserFriendlyError(err));
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const formatFinancialNumber = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const blob = await exportTransferSheetBatchExcel(activeLines, batch?.batchNumber);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `Transfer_Netting_Sheet_${batch?.batchNumber || 'Export'}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export formatted netting excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Transfer Netting Sheet
            </h2>
            {allBatches && allBatches.length > 0 && onSelectBatch ? (
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600">Batch:</span>
                <select
                  value={batch?.id || ''}
                  onChange={(e) => onSelectBatch(e.target.value)}
                  className="bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 rounded-lg px-2 py-0.5 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
                  title="Switch between different uploaded transfer sheet batches"
                >
                  {allBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} [{b.status}] — {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({b.totalNetAmount >= 0 ? '+' : ''}{b.totalNetAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} EGP)
                    </option>
                  ))}
                </select>
              </div>
            ) : batch?.batchNumber ? (
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                {batch.batchNumber}
              </span>
            ) : null}
            {batch?.status && (
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  batch.status === 'LOCKED' || reviewStatus === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : batch.status === 'PENDING_REVIEW'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : batch.status === 'MODIFIED'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {batch.status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            System Net Transfer = Σ(Allocated Qty × Price) | Final Transfer = System Net + Adjustment Amount
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* User Requested: Formatted Excel Export matching UI red/green styling */}
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || activeLines.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-xs transition"
            title="Download Formatted Excel with Red (Transfer) and Green (Receive) indicators"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {isExportingExcel ? 'Generating Excel...' : 'Export Excel (.xlsx)'}
          </button>

          {/* Export CSV button */}
          <button
            onClick={() => {
              const csvContent =
                'data:text/csv;charset=utf-8,' +
                ['Symbol Code,Fund Name,System Buy,System Sell,System Net Transfer,Adjustment Amount,Final Transfer Amount']
                  .concat(
                    activeLines.map(
                      (l) =>
                        `"${l.symbolCode}","${l.symbolName}",${l.systemBuyAmount},${l.systemSellAmount},${l.systemNetAmount},${l.adjustmentAmount},${l.finalTransferAmount}`
                    )
                  )
                  .join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', `Transfer_Sheet_${batch?.batchNumber || 'export'}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            CSV
          </button>

          {!isLocked && (
            <>
              {!isPendingReview && !isAuditor && (
                <button
                  onClick={onMakerSubmit}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
                >
                  <FileCheck className="w-4 h-4" />
                  Submit Draft for Review
                </button>
              )}

              {canApprove && (
                <button
                  onClick={onCheckerApprove}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve & Lock Transfer Sheet
                </button>
              )}
            </>
          )}

          {isLocked && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-xl border border-emerald-300">
                <Lock className="w-4 h-4 text-emerald-600" />
                Transfer Batch Locked
              </div>
              {onNewBatch && (
                <button
                  onClick={onNewBatch}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  + New Transfer Sheet
                </button>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Main Netting Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Fund Code</th>
                <th className="py-3.5 px-4">Fund Name</th>
                <th className="py-3.5 px-4 text-right">System Buy (EGP)</th>
                <th className="py-3.5 px-4 text-right">System Sell (EGP)</th>
                <th className="py-3.5 px-4 text-right">System Net (EGP)</th>
                <th className="py-3.5 px-4 text-right">Adjustment (EGP)</th>
                <th className="py-3.5 px-4 text-right">Final Transfer (EGP)</th>
                <th className="py-3.5 px-4 text-center">Audit & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {activeLines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">
                        No transfer draft available
                      </p>
                      <p className="text-xs text-slate-500 max-w-md">
                        To generate the transfer netting sheet, please upload your trade allocation file in the Trade Files tab.
                      </p>
                      {onNavigateToUpload && (
                        <button
                          onClick={onNavigateToUpload}
                          className="mt-2 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition"
                        >
                          <UploadCloud className="w-4 h-4" />
                          Go to Trade Files
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                activeLines.map((line) => {
                  const hasAdjustment = line.adjustmentAmount !== 0;

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {line.symbolCode}
                        {line.actualSymbol && line.actualSymbol !== line.symbolCode && (
                          <span className="text-[10px] text-slate-600 block">{line.actualSymbol}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium max-w-xs truncate" title={line.symbolName}>
                        {line.symbolName}
                      </td>

                      {/* 1. System Buy (Immutable) */}
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {formatFinancialNumber(line.systemBuyAmount)}
                      </td>

                      {/* 2. System Sell (Immutable) */}
                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {formatFinancialNumber(line.systemSellAmount)}
                      </td>

                      {/* 3. System Net (Immutable) - Accounting Red/Green */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            formatAccountingUI(line.systemNetAmount).colorClass
                          }`}
                        >
                          {formatAccountingUI(line.systemNetAmount).text}
                        </span>
                      </td>

                      {/* 4. Adjustment Amount (Editable with Category) */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasAdjustment && line.adjustmentCategory && (
                            <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              {CATEGORY_LABELS[line.adjustmentCategory] || line.adjustmentCategory}
                            </span>
                          )}
                          <span
                            className={`font-semibold ${
                              hasAdjustment
                                ? formatAccountingUI(line.adjustmentAmount).inlineColor
                                : 'text-slate-400'
                            }`}
                          >
                            {hasAdjustment ? formatAccountingUI(line.adjustmentAmount).text : '0.00'}
                          </span>

                          {canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(line)}
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Adjust Transfer Amount"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. Final Transfer Amount (System Net + Adjustment) - Accounting Red/Green */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2.5 py-1 rounded text-xs ${
                            formatAccountingUI(line.finalTransferAmount).colorClass
                          }`}
                        >
                          {formatAccountingUI(line.finalTransferAmount).text}
                        </span>
                      </td>

                      {/* 6. Audit & Status */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : hasAdjustment ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Adjusted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                              System
                            </span>
                          )}

                          {line.adjustments && line.adjustments.length > 0 && (
                            <button
                              onClick={() => setSelectedAuditHistory(line)}
                              className="p-1 text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                              title={`View ${line.adjustments.length} adjustment audit record(s)`}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {editingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Adjust Final Transfer Amount
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {editingModal.symbolName} ({editingModal.symbolCode})
              </p>
            </div>

            {adjustmentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustmentError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Read-Only System Net Transfer */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">System Net Transfer (Immutable):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatFinancialNumber(editingModal.systemNet)} EGP
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  Derived directly from execution trades: Σ(Allocated Qty × Price)
                </p>
              </div>

              {/* Adjustment Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={adjustmentCategory}
                  onChange={(e) => setAdjustmentCategory(e.target.value as AdjustmentCategory)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BANK_FEE">Bank Fee</option>
                  <option value="SETTLEMENT_DIFFERENCE">Settlement Difference</option>
                  <option value="CUSTODIAN_CORRECTION">Custodian Correction</option>
                  <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Final Transfer Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Final Transfer Amount (EGP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustmentAmountInput}
                  onChange={(e) => setAdjustmentAmountInput(e.target.value)}
                  className="w-full text-sm font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the final amount to transfer"
                />
                <p className="text-[11px] text-slate-600 mt-1">
                  This value is the exact final transfer amount that will be sent for this fund.
                </p>
              </div>

              {/* Calculated Adjustment Difference (Delta) */}
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-900 font-bold">Adjustment Difference (Delta):</span>
                  <span className="font-mono font-bold text-blue-900 text-sm">
                    {formatFinancialNumber(
                      (parseFloat(adjustmentAmountInput) || 0) - editingModal.systemNet
                    )}{' '}
                    EGP
                  </span>
                </div>
              </div>

              {/* Mandatory Justification Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Justification Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="State the business reason for this adjustment..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-600 mt-1">
                  <span>Mandatory reason for audit trail</span>
                  <span
                    className={
                      adjustmentReason.trim().length >= 1 ? 'text-emerald-600 font-bold' : 'text-slate-500'
                    }
                  >
                    {adjustmentReason.trim().length > 0 ? `${adjustmentReason.trim().length} char(s)` : 'Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingModal(null)}
                disabled={isSubmittingAdjustment}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdjustment}
                disabled={isSubmittingAdjustment || adjustmentReason.trim().length < 1}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition"
              >
                {isSubmittingAdjustment ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {selectedAuditHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjustment Audit Trail</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedAuditHistory.symbolName} ({selectedAuditHistory.symbolCode})
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditHistory(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {selectedAuditHistory.adjustments?.map((adj) => (
                <div key={adj.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {CATEGORY_LABELS[adj.adjustmentCategory] || adj.adjustmentCategory}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">{adj.timestampUtc}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-500">
                      Old Adj: {formatFinancialNumber(adj.oldAdjustmentAmount)}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-amber-700 font-bold">
                      New Adj: {formatFinancialNumber(adj.newAdjustmentAmount)}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      (Final: {formatFinancialNumber(adj.resultingFinalTransfer)})
                    </span>
                  </div>
                  <p className="text-slate-700 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    &quot;{adj.reason}&quot;
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Adjusted by: <span className="font-semibold">{adj.userName}</span> (IP: {adj.clientIp})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
