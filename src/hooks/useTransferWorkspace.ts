// Transfer Workspace Domain Hook
// Manages Transfer Sheet batches, netting rows, review lifecycle & 4-Eyes principle

'use client';

import { useState } from 'react';
import {
  AdjustmentCategory,
  NettingRow,
  RawTransactionRow,
  ReferenceData,
  TransferSheetBatch,
  UserRole,
} from '@/lib/types';
import { TransferBatchSummary } from '@/lib/repositories/transferRepository';
import {
  adjustTransferLineAction,
  getLatestTransferBatchAction,
  reviewTransferBatchAction,
  submitTransferBatchAction,
} from '@/app/actions/transferActions';
import { fetchTransferBatchByIdAction } from '@/app/actions/workspaceActions';
import { calculateNettingSheet, FundReviewState } from '@/lib/netting-engine';
import { formatUserFriendlyError } from '@/lib/error-formatter';

export interface UseTransferWorkspaceProps {
  currentUser: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole;
  } | null;
  rawTransactions: RawTransactionRow[];
  referenceDataList: ReferenceData[];
  onAuditLog: (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => void;
  onError: (error: string | null) => void;
  onRefreshAuditLogs?: () => Promise<void>;
}

export function useTransferWorkspace({
  currentUser,
  rawTransactions,
  referenceDataList,
  onAuditLog,
  onError,
  onRefreshAuditLogs,
}: UseTransferWorkspaceProps) {
  const [currentTransferBatch, setCurrentTransferBatch] = useState<TransferSheetBatch | null>(null);
  const [allBatches, setAllBatches] = useState<TransferBatchSummary[]>([]);
  const [reviewStatus, setReviewStatus] = useState<'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED'>('DRAFT');
  const [makerName, setMakerName] = useState<string>('');
  const [checkerName, setCheckerName] = useState<string>('');
  const [perFundReviewStates, setPerFundReviewStates] = useState<Record<string, FundReviewState>>({});
  const [fourEyesError, setFourEyesError] = useState<{
    message: string;
    makerName?: string;
  } | null>(null);

  const fallbackNetting =
    rawTransactions.length > 0 && referenceDataList.length > 0
      ? calculateNettingSheet(rawTransactions, referenceDataList, 'symbol', perFundReviewStates)
      : null;

  const effectiveNettingRows: NettingRow[] =
    currentTransferBatch?.lines && currentTransferBatch.lines.length > 0
      ? currentTransferBatch.lines.map((l) => ({
          symbolCode: l.symbolCode,
          symbolName: l.symbolName,
          actualSymbol: l.actualSymbol || l.symbolCode,
          currency: 'EGP' as const,
          buyTotal: l.systemBuyAmount,
          sellTotal: l.systemSellAmount,
          netAmount: l.finalTransferAmount,
          status: (l.finalTransferAmount > 0
            ? 'POSITIVE'
            : l.finalTransferAmount < 0
            ? 'NEGATIVE'
            : 'NEUTRAL') as 'NEUTRAL' | 'POSITIVE' | 'NEGATIVE',
          reviewStatus: (currentTransferBatch.status === 'APPROVED' || currentTransferBatch.status === 'LOCKED'
            ? 'APPROVED'
            : currentTransferBatch.status === 'PENDING_REVIEW'
            ? 'UNDER_REVIEW'
            : 'DRAFT') as 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED',
        }))
      : fallbackNetting?.rows || [];

  const effectiveTotalBuy = currentTransferBatch
    ? currentTransferBatch.totalBuyAmount
    : fallbackNetting?.totalBuy || 0;
  const effectiveTotalSell = currentTransferBatch
    ? currentTransferBatch.totalSellAmount
    : fallbackNetting?.totalSell || 0;
  const effectiveTotalNet = currentTransferBatch
    ? currentTransferBatch.totalNetAmount
    : fallbackNetting?.totalNet || 0;

  const handleMakerSubmit = async () => {
    if (currentTransferBatch) {
      await submitTransferBatchAction(currentTransferBatch.id);
      const freshBatch = await getLatestTransferBatchAction();
      if (freshBatch) setCurrentTransferBatch(freshBatch);
    }
    setReviewStatus('UNDER_REVIEW');
    setMakerName(currentUser?.fullName || 'Maker');

    const updatedStates: Record<string, FundReviewState> = {};
    effectiveNettingRows.forEach((r) => {
      updatedStates[r.symbolCode] = {
        reviewStatus: 'UNDER_REVIEW',
        makerName: currentUser?.fullName || 'Maker',
      };
    });
    setPerFundReviewStates(updatedStates);
    onAuditLog('SUBMIT_REVIEW', 'TRANSFER_SHEET', currentTransferBatch?.id || 'sheet-all', {
      status: 'UNDER_REVIEW',
    });
  };

  const handleCheckerApprove = async () => {
    if (currentTransferBatch) {
      const res = await reviewTransferBatchAction(currentTransferBatch.id, 'APPROVE');
      if (!res.success) {
        if (res.error?.includes('Four-Eyes') || res.error?.toLowerCase().includes('maker cannot approve')) {
          setFourEyesError({
            message: res.error,
            makerName: currentTransferBatch.makerName || makerName,
          });
        } else {
          onError(res.error || 'Failed to approve transfer sheet batch.');
        }
        return;
      }
      const freshBatch = await getLatestTransferBatchAction();
      if (freshBatch) setCurrentTransferBatch(freshBatch);
    } else {
      const effectiveMaker = makerName || '';
      const userIdentities = [currentUser?.fullName, currentUser?.email, currentUser?.id].filter(Boolean);
      if (effectiveMaker && userIdentities.includes(effectiveMaker)) {
        setFourEyesError({
          message: `Four-Eyes Principle Violation: Maker cannot approve their own submitted transfer sheet (${effectiveMaker}). A different checker must review.`,
          makerName: effectiveMaker,
        });
        return;
      }
    }

    setReviewStatus('APPROVED');
    setCheckerName(currentUser?.fullName || 'Checker');

    const updatedStates: Record<string, FundReviewState> = {};
    effectiveNettingRows.forEach((r) => {
      updatedStates[r.symbolCode] = {
        reviewStatus: 'APPROVED',
        makerName: makerName || 'Maker',
        checkerName: currentUser?.fullName || 'Checker',
        approvedAt: new Date().toISOString(),
      };
    });
    setPerFundReviewStates(updatedStates);
    onAuditLog('APPROVE_TRANSFER', 'TRANSFER_SHEET', currentTransferBatch?.id || 'sheet-all', {
      status: 'APPROVED',
    });
  };

  const handleAdjustTransferLine = async (
    lineId: string,
    symbolCode: string,
    systemNetSnapshot: number,
    oldAdjustmentAmount: number,
    newAdjustmentAmount: number,
    adjustmentCategory: AdjustmentCategory,
    reason: string
  ) => {
    if (!currentTransferBatch) return;
    const res = await adjustTransferLineAction(
      currentTransferBatch.id,
      lineId,
      symbolCode,
      systemNetSnapshot,
      oldAdjustmentAmount,
      newAdjustmentAmount,
      adjustmentCategory,
      reason
    );
    if (!res.success) {
      throw new Error(res.error || 'Failed to adjust line');
    }
    const freshBatch = await getLatestTransferBatchAction();
    if (freshBatch) setCurrentTransferBatch(freshBatch);
    if (onRefreshAuditLogs) await onRefreshAuditLogs();
  };

  const handleReviewSingleFund = (symbolCode: string, newStatus: 'UNDER_REVIEW' | 'APPROVED') => {
    if (newStatus === 'APPROVED') {
      const fundMaker = perFundReviewStates[symbolCode]?.makerName || makerName;
      const userIdentities = [currentUser?.fullName, currentUser?.email, currentUser?.id].filter(Boolean);
      if (fundMaker && userIdentities.includes(fundMaker)) {
        setFourEyesError({
          message: `Four-Eyes Principle Violation: Maker cannot approve their own submitted fund sheet for ${symbolCode} (${fundMaker}). A different checker must review.`,
          makerName: fundMaker,
        });
        return;
      }
    }

    setPerFundReviewStates((prev) => ({
      ...prev,
      [symbolCode]: {
        reviewStatus: newStatus,
        makerName: newStatus === 'UNDER_REVIEW' ? currentUser?.fullName : prev[symbolCode]?.makerName,
        checkerName: newStatus === 'APPROVED' ? currentUser?.fullName : prev[symbolCode]?.checkerName,
        approvedAt: newStatus === 'APPROVED' ? new Date().toISOString() : undefined,
      },
    }));

    onAuditLog(
      newStatus === 'UNDER_REVIEW' ? 'SUBMIT_SINGLE_FUND' : 'APPROVE_SINGLE_FUND',
      'FUND_SHEET',
      symbolCode,
      { symbolCode, newStatus }
    );
  };

  const handleNewTransferSheet = () => {
    setCurrentTransferBatch(null);
    setReviewStatus('DRAFT');
    setMakerName('');
    setCheckerName('');
    setPerFundReviewStates({});
    const uploaderEl = document.getElementById('allocation-uploader-section');
    if (uploaderEl) {
      uploaderEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectBatch = async (batchId: string) => {
    try {
      const selected = await fetchTransferBatchByIdAction(batchId);
      if (selected) {
        setCurrentTransferBatch(selected);
        setReviewStatus(
          selected.status === 'LOCKED'
            ? 'APPROVED'
            : selected.status === 'PENDING_REVIEW'
            ? 'UNDER_REVIEW'
            : 'DRAFT'
        );
      }
    } catch (err) {
      onError(formatUserFriendlyError(err));
    }
  };

  return {
    currentTransferBatch,
    setCurrentTransferBatch,
    allBatches,
    setAllBatches,
    reviewStatus,
    setReviewStatus,
    makerName,
    setMakerName,
    checkerName,
    setCheckerName,
    perFundReviewStates,
    setPerFundReviewStates,
    fourEyesError,
    setFourEyesError,
    effectiveNettingRows,
    effectiveTotalBuy,
    effectiveTotalSell,
    effectiveTotalNet,
    handleMakerSubmit,
    handleCheckerApprove,
    handleAdjustTransferLine,
    handleReviewSingleFund,
    handleNewTransferSheet,
    handleSelectBatch,
  };
}
