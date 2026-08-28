// Main Workspace Component (White & Emerald Green Theme with Real Auth & Supabase DB)

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

import {
  AuditLog,
  ChecklistItem,
  ExceptionRecord,
  GeneratedTransactionRow,
  RawTransactionRow,
  ReferenceData,
  UploadedFileRecord,
  UserRole,
} from '@/lib/types';
import {
  fetchReferenceDataFromDb,
  insertReferenceDataToDb,
  saveAuditLogToDb,
  saveUploadedFileToDb,
  updateNavPriceInDb,
} from '@/lib/db-service';
import { INITIAL_AUDIT_LOGS, INITIAL_CHECKLISTS } from '@/lib/store';
import { applyFundRules } from '@/lib/rule-engine';
import { calculateNettingSheet } from '@/lib/netting-engine';

export default function InvestmentPlatformPage() {
  // Real User Session State (Supabase Auth / Session Manager)
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    fullName: string;
    role: UserRole;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Dynamic Stores initialized from Supabase DB
  const [referenceDataList, setReferenceDataList] = useState<ReferenceData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [rawTransactions, setRawTransactions] = useState<RawTransactionRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>(INITIAL_CHECKLISTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);

  // Netting Review Workflow State
  const [reviewStatus, setReviewStatus] = useState<'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED'>('DRAFT');
  const [makerName, setMakerName] = useState<string>('');
  const [checkerName, setCheckerName] = useState<string>('');

  // Load Dynamic Reference Data from Supabase PostgreSQL on Mount
  useEffect(() => {
    async function loadDbData() {
      const dbRefData = await fetchReferenceDataFromDb();
      setReferenceDataList(dbRefData);
    }
    loadDbData();
  }, []);

  // Handle File Upload Event
  const handleFileUpload = async (fileRecord: UploadedFileRecord, parsedRows: RawTransactionRow[]) => {
    setUploadedFiles((prev) => [fileRecord, ...prev]);
    setRawTransactions((prev) => [...parsedRows, ...prev]);

    // Save to Supabase PostgreSQL Database
    await saveUploadedFileToDb(fileRecord, parsedRows);

    // Flexible Reference Data matching
    const newExceptions: ExceptionRecord[] = [];
    parsedRows.forEach((row) => {
      const symClean = row.symbol.trim().toLowerCase();
      const descClean = row.symbolDescription.trim().toLowerCase();

      const match = referenceDataList.find(
        (r) =>
          r.symbolCode.toLowerCase() === symClean ||
          r.actualSymbol.toLowerCase() === symClean ||
          r.symbolName.toLowerCase() === descClean ||
          r.symbolName.toLowerCase() === symClean ||
          r.symbolCode.toLowerCase() === descClean ||
          r.actualSymbol.toLowerCase() === descClean
      );

      if (!match) {
        newExceptions.push({
          id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fileId: fileRecord.id,
          fileName: fileRecord.fileName,
          exceptionType: 'UNKNOWN_SYMBOL',
          errorMessage: `Unmapped symbol "${row.symbol}" (${row.symbolDescription}) detected in trade row.`,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (newExceptions.length > 0) {
      setExceptions((prev) => [...newExceptions, ...prev]);
    }

    // Update Checklist Item #1
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === 'chk-1'
          ? {
              ...c,
              isCompleted: true,
              completedBy: currentUser?.email || 'user-ops-1',
              completedByName: currentUser?.fullName || 'Ahmed Hassan (Maker)',
              completedAt: new Date().toISOString(),
            }
          : c
      )
    );

    // Audit Log to DB
    addAuditLog('FILE_INGESTION', 'UPLOADED_FILE', fileRecord.id, {
      fileName: fileRecord.fileName,
      rowCount: parsedRows.length,
      hash: fileRecord.fileHashSha256,
    });
  };

  const addAuditLog = async (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      userId: currentUser?.email || 'user-system',
      userName: currentUser?.fullName || 'System User',
      action,
      entityName,
      entityId,
      ipAddress: '192.168.1.45',
      timestampUtc: new Date().toISOString(),
      newValues,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    await saveAuditLogToDb(newLog);
  };

  // Evaluate Dynamic Rules to generate output transaction rows
  const generatedRows: GeneratedTransactionRow[] = rawTransactions.map((tx) => {
    const symClean = tx.symbol.trim().toLowerCase();
    const descClean = tx.symbolDescription.trim().toLowerCase();
    const refMatch = referenceDataList.find(
      (r) =>
        r.symbolCode.toLowerCase() === symClean ||
        r.actualSymbol.toLowerCase() === symClean ||
        r.symbolName.toLowerCase() === descClean ||
        r.symbolName.toLowerCase() === symClean
    );
    const fundType = refMatch ? 'T0' : 'T0';
    return applyFundRules(tx, fundType);
  });

  const nettingSummary = calculateNettingSheet(rawTransactions, referenceDataList);

  const handleMakerSubmit = () => {
    setReviewStatus('UNDER_REVIEW');
    setMakerName(currentUser?.fullName || 'Ahmed Hassan (Maker)');
    addAuditLog('SUBMIT_REVIEW', 'TRANSFER_SHEET', 'sheet-1', { status: 'UNDER_REVIEW' });
  };

  const handleCheckerApprove = () => {
    setReviewStatus('APPROVED');
    setCheckerName(currentUser?.fullName || 'Checker Supervisor');
    addAuditLog('APPROVE_TRANSFER', 'TRANSFER_SHEET', 'sheet-1', { status: 'APPROVED' });
  };

  const handleToggleChecklist = (itemId: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: true,
              completedBy: currentUser?.email || 'user-ops-1',
              completedByName: currentUser?.fullName || 'Ops User',
              completedAt: new Date().toISOString(),
            }
          : c
      )
    );
    addAuditLog('CHECKLIST_COMPLETE', 'CHECKLIST_ITEM', itemId);
  };

  const handleReopenChecklist = (itemId: string, reason: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: false,
              reopenedBy: currentUser?.email || 'user-admin-1',
              reopenedByName: currentUser?.fullName || 'Super Administrator',
              reopenedAt: new Date().toISOString(),
              reopenReason: reason,
            }
          : c
      )
    );
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
    addAuditLog('CREATE_REFERENCE_DATA', 'REFERENCE_DATA', createdItem.id, { symbolCode: createdItem.symbolCode });
  };

  const handleUpdateNavPrice = async (id: string, newPrice: number) => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, navUnitPrice: newPrice } : r))
    );
    await updateNavPriceInDb(id, newPrice);
    addAuditLog('UPDATE_NAV_PRICE', 'REFERENCE_DATA', id, { newPrice });
  };

  // If user is not logged in, render Login Form (White & Emerald Green Theme)
  if (!currentUser) {
    return <LoginForm onLoginSuccess={setCurrentUser} />;
  }

  const pendingReviewsCount = reviewStatus === 'UNDER_REVIEW' ? 1 : 0;
  const openExceptionsCount = exceptions.filter((e) => e.status === 'OPEN').length;
  const existingHashes = uploadedFiles.map((f) => f.fileHashSha256);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Navigation Header with Real User Profile & Logout */}
      <Navbar
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingReviewsCount={pendingReviewsCount}
        exceptionsCount={openExceptionsCount}
      />

      {/* Main Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* View Router */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <OverviewCards
              totalRowsProcessed={rawTransactions.length}
              totalFilesCount={uploadedFiles.length}
              totalBuyAmount={nettingSummary.totalBuy}
              totalSellAmount={nettingSummary.totalSell}
              totalNetAmount={nettingSummary.totalNet}
              pendingReviewsCount={pendingReviewsCount}
              exceptionsCount={openExceptionsCount}
              completedChecklistsCount={checklists.filter((c) => c.isCompleted).length}
              totalChecklistsCount={checklists.length}
            />

            <FileUploader onFileUpload={handleFileUpload} existingHashes={existingHashes} />

            {generatedRows.length > 0 && <TransactionReportTable rows={generatedRows} />}
          </div>
        )}

        {activeTab === 'ingestion' && (
          <div className="space-y-8">
            <FileUploader onFileUpload={handleFileUpload} existingHashes={existingHashes} />
            <TransactionReportTable rows={generatedRows} />
          </div>
        )}

        {activeTab === 'netting' && (
          <TransferSheetView
            nettingRows={nettingSummary.rows}
            totalBuy={nettingSummary.totalBuy}
            totalSell={nettingSummary.totalSell}
            totalNet={nettingSummary.totalNet}
            currentRole={currentUser.role}
            reviewStatus={reviewStatus}
            makerName={makerName}
            checkerName={checkerName}
            onMakerSubmit={handleMakerSubmit}
            onCheckerApprove={handleCheckerApprove}
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
          <ReferenceDataAdmin
            referenceDataList={referenceDataList}
            onAddReferenceData={handleAddReferenceData}
            onUpdateNavPrice={handleUpdateNavPrice}
          />
        )}
      </main>
    </div>
  );
}
