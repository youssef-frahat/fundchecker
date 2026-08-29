// Main Workspace Component (Production Engine Integrated - Zero Mock Data)

'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { LoginForm } from '@/components/auth/LoginForm';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { FileUploader } from '@/components/ingestion/FileUploader';
import { TransactionReportTable } from '@/components/reports/TransactionReportTable';
import { TransferSheetView } from '@/components/netting/TransferSheetView';
import { ChecklistEngine } from '@/components/checklists/ChecklistEngine';
import { ExceptionCenter } from '@/components/exceptions/ExceptionCenter';
import { AuditTrailViewer } from '@/components/audit/AuditTrailViewer';
import { ReferenceDataAdmin } from '@/components/admin/ReferenceDataAdmin';
import { UserManagementAdmin } from '@/components/admin/UserManagementAdmin';
import { SystemHealthAdmin } from '@/components/admin/SystemHealthAdmin';
import { ScheduleReminderSnackbar } from '@/components/common/ScheduleReminderSnackbar';

import {
  AdjustmentCategory,
  AuditLog,
  ChecklistItem,
  ExceptionRecord,
  FundRule,
  GeneratedTransactionRow,
  NettingRow,
  RawTransactionRow,
  ReferenceData,
  UploadedFileRecord,
  User as UserType,
  UserRole,
} from '@/lib/types';
import {
  insertReferenceDataToDb,
  updateReferenceDataInDb,
  archiveReferenceDataInDb,
} from '@/lib/db-service';
import { processTradeFileAction } from '@/app/actions/processingActions';
import {
  uploadAllocationFileAction,
  adjustTransferLineAction,
  submitTransferBatchAction,
  reviewTransferBatchAction,
  getLatestTransferBatchAction,
} from '@/app/actions/transferActions';
import {
  fetchWorkspaceDataAction,
  updateChecklistStatusAction,
  reopenChecklistAction,
  saveAuditLogAction,
  fetchAuditLogsAction,
} from '@/app/actions/workspaceActions';
import {
  createUserAction,
  toggleUserStatusAction,
  resetUserPasswordAction,
} from '@/app/actions/userActions';
import { getCurrentSessionUserAction, logoutUserAction } from '@/app/actions/authActions';
import { applyFundRules } from '@/lib/rule-engine';
import { calculateNettingSheet, FundReviewState } from '@/lib/netting-engine';
import { TransferSheetBatch } from '@/lib/types';

export default function InvestmentPlatformPage() {
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    email: string;
    fullName: string;
    role: UserRole;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentTransferBatch, setCurrentTransferBatch] = useState<TransferSheetBatch | null>(null);

  const [users, setUsers] = useState<UserType[]>([]);
  const [referenceDataList, setReferenceDataList] = useState<ReferenceData[]>([]);
  const [fundRules, setFundRules] = useState<FundRule[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [rawTransactions, setRawTransactions] = useState<RawTransactionRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Netting Review Workflow State
  const [reviewStatus, setReviewStatus] = useState<'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED'>('DRAFT');
  const [makerName, setMakerName] = useState<string>('');
  const [checkerName, setCheckerName] = useState<string>('');
  const [perFundReviewStates, setPerFundReviewStates] = useState<Record<string, FundReviewState>>({});
  const [dbSetupError, setDbSetupError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDbData() {
      const [{ user: sessionUser }, wsResult] = await Promise.all([
        getCurrentSessionUserAction(),
        fetchWorkspaceDataAction(),
      ]);

      if (sessionUser) {
        setCurrentUser(sessionUser);
      }
      if (wsResult) {
        if (wsResult.dbError) {
          setDbSetupError(wsResult.dbError);
        }
        setReferenceDataList(wsResult.refData || []);
        setFundRules(wsResult.fundRules || []);
        setUploadedFiles(wsResult.uploadedFiles || []);
        setExceptions(wsResult.exceptions || []);
        setAuditLogs(wsResult.auditLogs || []);
        setChecklists(wsResult.checklists || []);
        setUsers(wsResult.users || []);
        if (wsResult.latestBatch) {
          setCurrentTransferBatch(wsResult.latestBatch);
        }
      }
    }
    loadDbData();
  }, []);



  const handleFileUpload = async (
    fileRecord: UploadedFileRecord,
    parsedRows: RawTransactionRow[],
    category: 'ORDERS' | 'ALLOCATION' = 'ORDERS'
  ) => {
    setProcessingError(null);
    setUploadedFiles((prev) => [{ ...fileRecord, fileCategory: category }, ...prev]);

    if (category === 'ALLOCATION') {
      // Execute Allocation Ingestion Pipeline
      const allocResult = await uploadAllocationFileAction(
        fileRecord.fileName,
        fileRecord.fileHashSha256,
        fileRecord.fileSize,
        parsedRows
      );
      if (!allocResult.success || !allocResult.batch) {
        setProcessingError(allocResult.error || 'Allocation processing encountered a failure.');
        return;
      }
      setCurrentTransferBatch(allocResult.batch);
      setActiveTab('netting'); // Automatically navigate to Transfer Netting Sheet
      const freshLogs = await fetchAuditLogsAction();
      setAuditLogs(freshLogs);
      return;
    }

    // Otherwise: Standard Orders File pipeline for Transaction Reports
    setRawTransactions((prev) => [...parsedRows, ...prev]);

    // Execute Production Processing Engine via Server Action
    const result = await processTradeFileAction(
      fileRecord.fileName,
      fileRecord.fileHashSha256,
      fileRecord.fileSize,
      parsedRows
    );

    if (!result.success || !result.report) {
      setProcessingError(result.error || 'Processing pipeline encountered a failure.');
      return;
    }

    const report = result.report;

    // Refresh exceptions and audit logs from database execution report
    if (report.exceptions.length > 0) {
      setExceptions((prev) => [...report.exceptions, ...prev]);
    }

    // Refresh audit logs from DB
    const freshLogs = await fetchAuditLogsAction();
    setAuditLogs(freshLogs);
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
    const freshLogs = await fetchAuditLogsAction();
    setAuditLogs(freshLogs);
  };

  const addAuditLog = async (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => {
    const operatorName = currentUser?.fullName || currentUser?.email || 'System User';
    const operatorId = currentUser?.id && currentUser.id.includes('-') ? currentUser.id : 'system';

    const enrichedNewValues = {
      ...newValues,
      userName: operatorName,
      userEmail: currentUser?.email,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      userId: operatorId,
      userName: operatorName,
      action,
      entityName,
      entityId,
      ipAddress: 'CLIENT',
      timestampUtc: new Date().toISOString(),
      newValues: enrichedNewValues,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    await saveAuditLogAction(newLog);
  };

  const generatedRows: GeneratedTransactionRow[] = (fundRules.length > 0 && referenceDataList.length > 0)
    ? rawTransactions.map((tx) => {
        const symClean = tx.symbol.trim().toLowerCase();
        const descClean = tx.symbolDescription.trim().toLowerCase();
        const refMatch = referenceDataList.find(
          (r) =>
            r.symbolCode.toLowerCase() === symClean ||
            r.actualSymbol.toLowerCase() === symClean ||
            r.symbolName.toLowerCase() === descClean ||
            r.symbolName.toLowerCase() === symClean
        );
        const fundType = refMatch ? (refMatch.fundType || 'T0') : 'T0';
        return applyFundRules(tx, fundType, fundRules);
      })
    : [];


  const nettingSummary = calculateNettingSheet(rawTransactions, referenceDataList, 'symbol', perFundReviewStates);

  const effectiveNettingRows: NettingRow[] = currentTransferBatch?.lines && currentTransferBatch.lines.length > 0
    ? currentTransferBatch.lines.map((l) => ({
        symbolCode: l.symbolCode,
        symbolName: l.symbolName,
        actualSymbol: l.actualSymbol || l.symbolCode,
        currency: 'EGP' as const,
        buyTotal: l.systemBuyAmount,
        sellTotal: l.systemSellAmount,
        netAmount: l.finalTransferAmount,
        status: (l.finalTransferAmount > 0 ? 'POSITIVE' : l.finalTransferAmount < 0 ? 'NEGATIVE' : 'NEUTRAL') as 'NEUTRAL' | 'POSITIVE' | 'NEGATIVE',
        reviewStatus: (currentTransferBatch.status === 'APPROVED' || currentTransferBatch.status === 'LOCKED'
          ? 'APPROVED'
          : currentTransferBatch.status === 'PENDING_REVIEW'
          ? 'UNDER_REVIEW'
          : 'DRAFT') as 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED',
      }))
    : nettingSummary.rows;

  const effectiveTotalBuy = currentTransferBatch ? currentTransferBatch.totalBuyAmount : nettingSummary.totalBuy;
  const effectiveTotalSell = currentTransferBatch ? currentTransferBatch.totalSellAmount : nettingSummary.totalSell;
  const effectiveTotalNet = currentTransferBatch ? currentTransferBatch.totalNetAmount : nettingSummary.totalNet;

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
    addAuditLog('SUBMIT_REVIEW', 'TRANSFER_SHEET', currentTransferBatch?.id || 'sheet-all', { status: 'UNDER_REVIEW' });
  };

  const handleCheckerApprove = async () => {
    if (currentTransferBatch) {
      await reviewTransferBatchAction(currentTransferBatch.id, 'APPROVE');
      const freshBatch = await getLatestTransferBatchAction();
      if (freshBatch) setCurrentTransferBatch(freshBatch);
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
    addAuditLog('APPROVE_TRANSFER', 'TRANSFER_SHEET', currentTransferBatch?.id || 'sheet-all', { status: 'APPROVED' });
  };

  const handleReviewSingleFund = (symbolCode: string, newStatus: 'UNDER_REVIEW' | 'APPROVED') => {
    setPerFundReviewStates((prev) => ({
      ...prev,
      [symbolCode]: {
        reviewStatus: newStatus,
        makerName: newStatus === 'UNDER_REVIEW' ? currentUser?.fullName : prev[symbolCode]?.makerName,
        checkerName: newStatus === 'APPROVED' ? currentUser?.fullName : prev[symbolCode]?.checkerName,
        approvedAt: newStatus === 'APPROVED' ? new Date().toISOString() : undefined,
      },
    }));

    addAuditLog(
      newStatus === 'UNDER_REVIEW' ? 'SUBMIT_SINGLE_FUND' : 'APPROVE_SINGLE_FUND',
      'FUND_SHEET',
      symbolCode,
      { symbolCode, newStatus }
    );
  };

  const handleToggleChecklist = async (itemId: string) => {
    if (!currentUser) return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;

    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: true,
              completedBy: userEmail,
              completedByName: userName,
              completedAt: new Date().toISOString(),
            }
          : c
      )
    );

    await updateChecklistStatusAction(itemId, true, userEmail, userName);
    addAuditLog('CHECKLIST_COMPLETE', 'CHECKLIST_ITEM', itemId);
  };

  const handleReopenChecklist = async (itemId: string, reason: string) => {
    if (!currentUser) return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;


    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: false,
              reopenedBy: userEmail,
              reopenedByName: userName,
              reopenedAt: new Date().toISOString(),
              reopenReason: reason,
            }
          : c
      )
    );

    await reopenChecklistAction(itemId, userEmail, userName, reason);
    addAuditLog('REOPEN_CHECKLIST', 'CHECKLIST_ITEM', itemId, { reason });
  };

  const handleResolveException = (id: string) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex))
    );
    addAuditLog('RESOLVE_EXCEPTION', 'EXCEPTION_RECORD', id);
  };

  const handleAddReferenceData = async (item: Omit<ReferenceData, 'id'>) => {
    const createdItem = await insertReferenceDataToDb(item);
    setReferenceDataList((prev) => [createdItem, ...prev]);
    addAuditLog('CREATE_REFERENCE_DATA', 'REFERENCE_DATA', createdItem.id, { symbolCode: createdItem.symbolCode, fundType: createdItem.fundType });
  };

  const handleUpdateReferenceData = async (updatedItem: ReferenceData) => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === updatedItem.id ? updatedItem : r))
    );
    await updateReferenceDataInDb(updatedItem);
    addAuditLog('UPDATE_FUND_REFERENCE', 'REFERENCE_DATA', updatedItem.id, {
      symbolCode: updatedItem.symbolCode,
      fundType: updatedItem.fundType,
      status: updatedItem.status,
    });
  };

  const handleArchiveReferenceData = async (id: string, status: 'ACTIVE' | 'ARCHIVED') => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    await archiveReferenceDataInDb(id, status);
    addAuditLog(status === 'ARCHIVED' ? 'ARCHIVE_FUND' : 'RESTORE_FUND', 'REFERENCE_DATA', id, { status });
  };

  const handleAddUser = async (newUser: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }): Promise<{ success: boolean; error?: string }> => {
    const res = await createUserAction(newUser);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    // Refresh real users list from database
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.users) {
      setUsers(wsData.users);
    }
    return { success: true };
  };

  const handleToggleUserStatus = async (
    id: string,
    newStatus: 'ACTIVE' | 'INACTIVE'
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await toggleUserStatusAction(id, newStatus);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    // Refresh real users list from database
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.users) {
      setUsers(wsData.users);
    }
    return { success: true };
  };

  const handleResetPassword = async (
    email: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return await resetUserPasswordAction(email);
  };

  if (!currentUser) {
    return <LoginForm onLoginSuccess={setCurrentUser} />;
  }

  const pendingReviewsCount = reviewStatus === 'UNDER_REVIEW' ? 1 : 0;
  const openExceptionsCount = exceptions.filter((e) => e.status === 'OPEN').length;
  const existingHashes = uploadedFiles.map((f) => f.fileHashSha256);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* ── DATABASE SETUP ERROR BANNER ─────────────────────────────── */}
      {dbSetupError && (
        <div className="bg-rose-600 text-white px-6 py-3 text-sm font-semibold flex items-center gap-3 border-b border-rose-700">
          <span className="text-lg">⚠</span>
          <span>
            <strong>DATABASE NOT SEEDED:</strong> {dbSetupError}
            {' — '}
            Run <code className="bg-rose-800 px-1 rounded font-mono text-xs">supabase/schema.sql</code> in the Supabase SQL editor to initialize the database.
          </span>
        </div>
      )}
      {/* ────────────────────────────────────────────────────────────── */}

      <Navbar
        currentUser={currentUser}
        onLogout={async () => {
          await logoutUserAction();
          setCurrentUser(null);
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingReviewsCount={pendingReviewsCount}
        exceptionsCount={openExceptionsCount}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {processingError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center justify-between">
            <span>Processing Pipeline Exception: {processingError}</span>
            <button onClick={() => setProcessingError(null)} className="text-rose-600 hover:text-rose-900 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <OverviewCards
              totalRowsProcessed={
                rawTransactions.length > 0
                  ? rawTransactions.length
                  : uploadedFiles.reduce((acc, f) => acc + (f.rowCount || 0), 0)
              }
              totalFilesCount={uploadedFiles.length}
              totalBuyAmount={
                currentTransferBatch
                  ? currentTransferBatch.totalBuyAmount
                  : nettingSummary.totalBuy
              }
              totalSellAmount={
                currentTransferBatch
                  ? currentTransferBatch.totalSellAmount
                  : nettingSummary.totalSell
              }
              totalNetAmount={
                currentTransferBatch
                  ? currentTransferBatch.totalNetAmount
                  : nettingSummary.totalNet
              }

              pendingReviewsCount={pendingReviewsCount}
              exceptionsCount={openExceptionsCount}
              completedChecklistsCount={checklists.filter((c) => c.isCompleted).length}
              totalChecklistsCount={checklists.length}
            />


            <FileUploader
              onFileUpload={handleFileUpload}
              existingHashes={existingHashes}
              uploaderEmail={currentUser?.email}
              uploaderName={currentUser?.fullName}
            />

            {generatedRows.length > 0 && <TransactionReportTable rows={generatedRows} />}
          </div>
        )}

        {activeTab === 'ingestion' && (
          <div className="space-y-8">
            <FileUploader
              onFileUpload={handleFileUpload}
              existingHashes={existingHashes}
              uploaderEmail={currentUser?.email}
              uploaderName={currentUser?.fullName}
            />
            <TransactionReportTable rows={generatedRows} />
          </div>
        )}


        {activeTab === 'netting' && (
          <TransferSheetView
            nettingRows={effectiveNettingRows}
            totalBuy={effectiveTotalBuy}
            totalSell={effectiveTotalSell}
            totalNet={effectiveTotalNet}
            currentRole={currentUser.role}
            reviewStatus={reviewStatus}
            batch={currentTransferBatch}
            makerName={makerName}
            checkerName={checkerName}
            onMakerSubmit={handleMakerSubmit}
            onCheckerApprove={handleCheckerApprove}
            onNavigateToUpload={() => setActiveTab('ingestion')}
            onAdjustLine={handleAdjustTransferLine}
            onReviewSingleFund={handleReviewSingleFund}
          />
        )}

        {activeTab === 'checklists' && (
          <ChecklistEngine
            items={checklists}
            currentRole={currentUser.role}
            onToggleComplete={handleToggleChecklist}
            onReopenItem={handleReopenChecklist}
          />
        )}

        {activeTab === 'exceptions' && (
          <ExceptionCenter exceptions={exceptions} onResolveException={handleResolveException} />
        )}

        {activeTab === 'audit' && <AuditTrailViewer logs={auditLogs} />}

        {activeTab === 'admin' && currentUser.role === 'SUPER_ADMIN' && (
          <div className="space-y-8">
            <SystemHealthAdmin />
            <UserManagementAdmin
              users={users}
              onAddUser={handleAddUser}
              onToggleUserStatus={handleToggleUserStatus}
              onResetPassword={handleResetPassword}
            />
            <ReferenceDataAdmin
              referenceDataList={referenceDataList}
              onAddReferenceData={handleAddReferenceData}
              onUpdateReferenceData={handleUpdateReferenceData}
              onArchiveReferenceData={handleArchiveReferenceData}
            />
          </div>
        )}
      </main>

      {/* Operational Cycle Reminder Snackbar (e.g. Day 18, Thursdays, Wednesdays, Mondays) */}
      <ScheduleReminderSnackbar referenceDataList={referenceDataList} />
    </div>
  );
}
