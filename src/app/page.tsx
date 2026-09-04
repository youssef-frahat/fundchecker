// Main Workspace Component (Production Engine Integrated - Zero Mock Data)
// Refactored with Domain Hooks for Enterprise Architecture & Maintainability

'use client';

import React, { useEffect, useState } from 'react';
import { Layers, FileSpreadsheet } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { LoginForm } from '@/components/auth/LoginForm';
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
import { FourEyesAlertSnackbar } from '@/components/common/FourEyesAlertSnackbar';

import {
  AuditLog,
  FundRule,
  GeneratedTransactionRow,
  RawTransactionRow,
  ReferenceData,
  UploadedFileRecord,
  User as UserType,
  UserRole,
} from '@/lib/types';
import {
  createReferenceDataAction,
  updateReferenceDataAction,
  archiveReferenceDataAction,
  bulkImportReferenceDataAction,
} from '@/app/actions/referenceActions';
import { processTradeFileAction } from '@/app/actions/processingActions';
import { uploadAllocationFileAction } from '@/app/actions/transferActions';
import {
  fetchWorkspaceDataAction,
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
import { formatUserFriendlyError } from '@/lib/error-formatter';

// Domain Hooks
import { useTransferWorkspace } from '@/hooks/useTransferWorkspace';
import { useChecklistWorkspace } from '@/hooks/useChecklistWorkspace';
import { useExceptionWorkspace } from '@/hooks/useExceptionWorkspace';

export default function InvestmentPlatformPage() {
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    email: string;
    fullName: string;
    role: UserRole;
  } | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>('orders');
  const [users, setUsers] = useState<UserType[]>([]);
  const [referenceDataList, setReferenceDataList] = useState<ReferenceData[]>([]);
  const [fundRules, setFundRules] = useState<FundRule[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [rawTransactions, setRawTransactions] = useState<RawTransactionRow[]>([]);
  const [serverGeneratedRows, setServerGeneratedRows] = useState<GeneratedTransactionRow[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [dbSetupError, setDbSetupError] = useState<string | null>(null);

  // Keyset Cursor Paginated Audit Trail State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | undefined>(undefined);
  const [auditHasMore, setAuditHasMore] = useState<boolean>(false);
  const [isLoadingMoreAuditLogs, setIsLoadingMoreAuditLogs] = useState<boolean>(false);

  const addAuditLog = async (
    action: string,
    entityName: string,
    entityId?: string,
    newValues?: Record<string, unknown>
  ) => {
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

  const refreshAuditLogs = async () => {
    const fresh = await fetchAuditLogsAction(50);
    if (fresh.logs) {
      setAuditLogs(fresh.logs);
      setAuditNextCursor(fresh.nextCursor);
      setAuditHasMore(fresh.hasMore);
    }
  };

  const handleLoadMoreAuditLogs = async () => {
    if (!auditNextCursor || isLoadingMoreAuditLogs) return;
    setIsLoadingMoreAuditLogs(true);
    try {
      const res = await fetchAuditLogsAction(50, auditNextCursor);
      if (res.logs && res.logs.length > 0) {
        setAuditLogs((prev) => [...prev, ...res.logs]);
        setAuditNextCursor(res.nextCursor);
        setAuditHasMore(res.hasMore);
      } else {
        setAuditHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more audit logs:', err);
    } finally {
      setIsLoadingMoreAuditLogs(false);
    }
  };

  // Domain Workspaces
  const transferWs = useTransferWorkspace({
    currentUser,
    rawTransactions,
    referenceDataList,
    onAuditLog: addAuditLog,
    onError: (err) => setProcessingError(err),
    onRefreshAuditLogs: refreshAuditLogs,
  });

  const checklistWs = useChecklistWorkspace({
    currentUser,
    onAuditLog: addAuditLog,
  });

  const exceptionWs = useExceptionWorkspace({
    onAuditLog: addAuditLog,
    onError: (err) => setProcessingError(err),
    onRefreshAuditLogs: refreshAuditLogs,
  });

  useEffect(() => {
    async function loadDbData() {
      try {
        if (typeof window !== 'undefined') {
          const savedTab = localStorage.getItem('investment_active_tab');
          if (savedTab) setActiveTab(savedTab);
        }

        const [{ user: sessionUser }, wsResult, initialAuditResult] = await Promise.all([
          getCurrentSessionUserAction(),
          fetchWorkspaceDataAction(),
          fetchAuditLogsAction(50).catch(() => ({ logs: [], hasMore: false, nextCursor: undefined as string | undefined })),
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
          exceptionWs.setExceptions(wsResult.exceptions || []);
          checklistWs.setChecklists(wsResult.checklists || []);
          setUsers(wsResult.users || []);
          setUploadedFiles(wsResult.uploadedFiles || []);
          transferWs.setAllBatches(wsResult.allBatches || []);
          if (wsResult.latestBatch) {
            transferWs.setCurrentTransferBatch(wsResult.latestBatch);
          }
        }
        if (initialAuditResult && initialAuditResult.logs) {
          setAuditLogs(initialAuditResult.logs);
          setAuditNextCursor(initialAuditResult.nextCursor);
          setAuditHasMore(initialAuditResult.hasMore);
        }
      } catch (err) {
        console.warn('Session or workspace data load notice:', err);
      } finally {
        setIsVerifyingSession(false);
      }
    }
    loadDbData();
  }, []);

  // Synchronize checklists, exceptions, and audit logs in real-time across connected users every 8 seconds
  useEffect(() => {
    if (activeTab !== 'checklists' && activeTab !== 'audit' && activeTab !== 'exceptions') return;
    const interval = setInterval(async () => {
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success) {
        if (wsData.checklists) checklistWs.setChecklists(wsData.checklists);
        if (wsData.exceptions) exceptionWs.setExceptions(wsData.exceptions);
        if (wsData.auditLogs && auditLogs.length <= 50) {
          setAuditLogs(wsData.auditLogs);
        }
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [activeTab, auditLogs.length]);

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
        setProcessingError(formatUserFriendlyError(allocResult.error || 'Allocation processing encountered a failure.'));
        return;
      }
      if (allocResult.fileId) {
        setUploadedFiles((prev) => [
          { ...fileRecord, id: allocResult.fileId!, fileCategory: category },
          ...prev.filter((f) => f.id !== fileRecord.id),
        ]);
      }
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success) {
        if (wsData.uploadedFiles) setUploadedFiles(wsData.uploadedFiles);
        if (wsData.allBatches) transferWs.setAllBatches(wsData.allBatches);
      }
      transferWs.setCurrentTransferBatch(allocResult.batch);
      await refreshAuditLogs();
      return;
    }

    // Otherwise: Standard Orders File pipeline for Transaction Reports
    setRawTransactions(parsedRows);

    // Execute Production Processing Engine via Server Action
    const result = await processTradeFileAction(
      fileRecord.fileName,
      fileRecord.fileHashSha256,
      fileRecord.fileSize,
      parsedRows
    );

    if (!result.success || !result.report) {
      setProcessingError(formatUserFriendlyError(result.error || 'Processing pipeline encountered a failure.'));
      return;
    }

    const report = result.report;

    if (report.transactionGeneratorResult?.generatedRows) {
      setServerGeneratedRows(report.transactionGeneratorResult.generatedRows);
    }

    // Refresh exceptions and audit logs from database execution report
    if (report.exceptions.length > 0) {
      exceptionWs.setExceptions((prev) => [...report.exceptions, ...prev]);
    }

    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success) {
      if (wsData.uploadedFiles) setUploadedFiles(wsData.uploadedFiles);
      if (wsData.allBatches) transferWs.setAllBatches(wsData.allBatches);
    }

    await refreshAuditLogs();
  };

  const clientGeneratedRows: GeneratedTransactionRow[] =
    fundRules.length > 0 && referenceDataList.length > 0
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
          const fundType = refMatch ? refMatch.fundType || 'T0' : 'T0';
          return applyFundRules(tx, fundType, fundRules);
        })
      : [];

  const effectiveGeneratedRows: GeneratedTransactionRow[] =
    serverGeneratedRows.length > 0 ? serverGeneratedRows : clientGeneratedRows;

  // Reference Data Handlers
  const handleAddReferenceData = async (
    item: Omit<ReferenceData, 'id'>
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await createReferenceDataAction(item);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Failed to create fund.' };
    }
    setReferenceDataList((prev) => [res.data!, ...prev]);
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.refData) {
      setReferenceDataList(wsData.refData);
    }
    return { success: true };
  };

  const handleUpdateReferenceData = async (
    updatedItem: ReferenceData
  ): Promise<{ success: boolean; error?: string }> => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === updatedItem.id ? updatedItem : r))
    );
    const res = await updateReferenceDataAction(updatedItem);
    if (!res.success) {
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.refData) {
        setReferenceDataList(wsData.refData);
      }
      return { success: false, error: res.error || 'Failed to update fund in database.' };
    }
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.refData) {
      setReferenceDataList(wsData.refData);
    }
    return { success: true };
  };

  const handleArchiveReferenceData = async (
    id: string,
    status: 'ACTIVE' | 'ARCHIVED'
  ): Promise<{ success: boolean; error?: string }> => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    const res = await archiveReferenceDataAction(id, status);
    if (!res.success) {
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.refData) {
        setReferenceDataList(wsData.refData);
      }
      return { success: false, error: res.error || 'Failed to change fund status.' };
    }
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.refData) {
      setReferenceDataList(wsData.refData);
    }
    return { success: true };
  };

  const handleBulkImportReferenceData = async (
    items: Omit<ReferenceData, 'id'>[]
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    const res = await bulkImportReferenceDataAction(items);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to import master data.' };
    }
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.refData) {
      setReferenceDataList(wsData.refData);
    }
    await refreshAuditLogs();
    return { success: true, count: res.count };
  };

  // User Management Handlers
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

  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-slate-700">
        <div className="w-9 h-9 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-slate-500 font-semibold uppercase tracking-wider">
          Verifying Session &amp; Syncing Workspace...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginForm onLoginSuccess={setCurrentUser} />;
  }

  const pendingReviewsCount = transferWs.reviewStatus === 'UNDER_REVIEW' ? 1 : 0;
  const openExceptionsCount = exceptionWs.exceptions.filter((e) => e.status === 'OPEN').length;
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
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (typeof window !== 'undefined') {
            localStorage.setItem('investment_active_tab', tab);
          }
          fetchWorkspaceDataAction().then((wsData) => {
            if (wsData.success) {
              if (wsData.checklists) checklistWs.setChecklists(wsData.checklists);
              if (wsData.auditLogs) setAuditLogs(wsData.auditLogs);
              if (wsData.latestBatch) transferWs.setCurrentTransferBatch(wsData.latestBatch);
              if (wsData.allBatches) transferWs.setAllBatches(wsData.allBatches);
              if (wsData.exceptions) exceptionWs.setExceptions(wsData.exceptions);
            }
          });
        }}
        pendingReviewsCount={pendingReviewsCount}
        exceptionsCount={openExceptionsCount}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {processingError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-medium flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <span className="font-bold text-xs">⚠</span>
              </div>
              <div>
                <p className="font-bold text-rose-950 text-xs uppercase tracking-wider">Operational Notice</p>
                <p className="text-xs text-rose-800 mt-0.5">{processingError}</p>
              </div>
            </div>
            <button
              onClick={() => setProcessingError(null)}
              className="text-xs text-rose-700 hover:text-rose-950 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-100/60 transition"
            >
              Dismiss
            </button>
          </div>
        )}

        {(activeTab === 'orders' || activeTab === 'ingestion') && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="mb-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  Trade Orders File Ingestion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload daily trading file (39-column raw orders) to parse customer orders and generate fund transaction sheets.
                </p>
              </div>
              <FileUploader
                onFileUpload={handleFileUpload}
                existingHashes={existingHashes}
                uploaderEmail={currentUser?.email}
                uploaderName={currentUser?.fullName}
                defaultCategory="ORDERS"
                hideCategorySelector={true}
              />
            </div>
            <TransactionReportTable rows={effectiveGeneratedRows} />
          </div>
        )}

        {(activeTab === 'transfers' || activeTab === 'netting') && (
          <div className="space-y-8">
            <div id="allocation-uploader-section" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="mb-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                  Cash Netting &amp; Allocation Sheet Ingestion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload Daily Allocation Excel file to calculate System Net Transfer (Allocated Qty &times; Price: Net = Sell &minus; Buy), record audited adjustments, and perform 4-Eyes digital sign-off.
                </p>
              </div>
              <FileUploader
                onFileUpload={handleFileUpload}
                existingHashes={existingHashes}
                uploaderEmail={currentUser?.email}
                uploaderName={currentUser?.fullName}
                defaultCategory="ALLOCATION"
                hideCategorySelector={true}
              />
            </div>

            <TransferSheetView
              nettingRows={transferWs.effectiveNettingRows}
              totalBuy={transferWs.effectiveTotalBuy}
              totalSell={transferWs.effectiveTotalSell}
              totalNet={transferWs.effectiveTotalNet}
              currentRole={currentUser.role}
              reviewStatus={transferWs.reviewStatus}
              batch={transferWs.currentTransferBatch}
              allBatches={transferWs.allBatches}
              onSelectBatch={transferWs.handleSelectBatch}
              makerName={transferWs.makerName}
              checkerName={transferWs.checkerName}
              onMakerSubmit={transferWs.handleMakerSubmit}
              onCheckerApprove={transferWs.handleCheckerApprove}
              onNavigateToUpload={() => setActiveTab('orders')}
              onAdjustLine={transferWs.handleAdjustTransferLine}
              onReviewSingleFund={transferWs.handleReviewSingleFund}
              onNewBatch={transferWs.handleNewTransferSheet}
            />
          </div>
        )}

        {activeTab === 'checklists' && (
          <ChecklistEngine
            items={checklistWs.checklists}
            currentRole={currentUser.role}
            onToggleComplete={checklistWs.handleToggleChecklist}
            onApproveItem={checklistWs.handleApproveChecklist}
            onResolveLateItem={checklistWs.handleResolveLateChecklist}
            onResetDailyShift={checklistWs.handleResetDailyShift}
            onReopenItem={checklistWs.handleReopenChecklist}
          />
        )}

        {activeTab === 'exceptions' && (
          <ExceptionCenter
            exceptions={exceptionWs.exceptions}
            onResolveException={exceptionWs.handleResolveException}
            onResolveAllExceptions={exceptionWs.handleResolveAllExceptions}
            onCleanResolvedExceptions={exceptionWs.handleCleanResolvedExceptions}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailViewer
            logs={auditLogs}
            uploadedFiles={uploadedFiles}
            onLoadMore={handleLoadMoreAuditLogs}
            hasMore={auditHasMore}
            isLoadingMore={isLoadingMoreAuditLogs}
          />
        )}

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
              onBulkImportReferenceData={handleBulkImportReferenceData}
            />
          </div>
        )}
      </main>

      {/* Operational Cycle Reminder Snackbar */}
      <ScheduleReminderSnackbar referenceDataList={referenceDataList} />

      {/* Four-Eyes Principle Enforcement Alert Snackbar */}
      <FourEyesAlertSnackbar
        isOpen={Boolean(transferWs.fourEyesError)}
        onClose={() => transferWs.setFourEyesError(null)}
        makerName={transferWs.fourEyesError?.makerName}
        message={transferWs.fourEyesError?.message}
      />
    </div>
  );
}
