// Main Application Workspace - Enterprise Investment Management Platform

'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
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
  INITIAL_AUDIT_LOGS,
  INITIAL_CHECKLISTS,
  INITIAL_REFERENCE_DATA,
} from '@/lib/store';
import { applyFundRules } from '@/lib/rule-engine';
import { calculateNettingSheet } from '@/lib/netting-engine';

export default function InvestmentPlatformPage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('OPERATIONS_USER');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // State Stores
  const [referenceDataList, setReferenceDataList] = useState<ReferenceData[]>(INITIAL_REFERENCE_DATA);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [rawTransactions, setRawTransactions] = useState<RawTransactionRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>(INITIAL_CHECKLISTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);

  // Netting Review Workflow State
  const [reviewStatus, setReviewStatus] = useState<'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED'>('DRAFT');
  const [makerName, setMakerName] = useState<string>('');
  const [checkerName, setCheckerName] = useState<string>('');

  // Handle File Upload Event
  const handleFileUpload = (fileRecord: UploadedFileRecord, parsedRows: RawTransactionRow[]) => {
    setUploadedFiles((prev) => [fileRecord, ...prev]);
    setRawTransactions((prev) => [...parsedRows, ...prev]);

    // Check for unmapped symbols to populate Exception Queue
    const newExceptions: ExceptionRecord[] = [];
    parsedRows.forEach((row) => {
      const match = referenceDataList.find(
        (r) => r.symbolCode.toLowerCase() === row.symbol.toLowerCase() || r.actualSymbol.toLowerCase() === row.symbol.toLowerCase()
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

    // Auto-update Checklist Item #1
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === 'chk-1'
          ? {
              ...c,
              isCompleted: true,
              completedBy: 'user-ops-1',
              completedByName: 'Ahmed Hassan (Maker)',
              completedAt: new Date().toISOString(),
            }
          : c
      )
    );

    // Audit Log
    addAuditLog('FILE_INGESTION', 'UPLOADED_FILE', fileRecord.id, {
      fileName: fileRecord.fileName,
      rowCount: parsedRows.length,
      hash: fileRecord.fileHashSha256,
    });
  };

  // Helper to push Audit Logs
  const addAuditLog = (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      userId: currentRole === 'SUPER_ADMIN' ? 'user-admin-1' : 'user-ops-1',
      userName: currentRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Ahmed Hassan (Maker)',
      action,
      entityName,
      entityId,
      ipAddress: '192.168.1.45',
      timestampUtc: new Date().toISOString(),
      newValues,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Evaluate Dynamic Rules to generate output transaction rows
  const generatedRows: GeneratedTransactionRow[] = rawTransactions.map((tx) => {
    const refMatch = referenceDataList.find(
      (r) => r.symbolCode.toLowerCase() === tx.symbol.toLowerCase() || r.actualSymbol.toLowerCase() === tx.symbol.toLowerCase()
    );
    const fundType = refMatch ? 'T0' : 'T0'; // Default T0 rule
    return applyFundRules(tx, fundType);
  });

  // Calculate Netting Summary
  const nettingSummary = calculateNettingSheet(rawTransactions, referenceDataList);

  // Maker Submit for Review
  const handleMakerSubmit = () => {
    setReviewStatus('UNDER_REVIEW');
    setMakerName('Ahmed Hassan (Maker)');
    addAuditLog('SUBMIT_REVIEW', 'TRANSFER_SHEET', 'sheet-1', { status: 'UNDER_REVIEW' });
  };

  // Checker Approve Review (Enforces 4-Eyes Principle)
  const handleCheckerApprove = () => {
    setReviewStatus('APPROVED');
    setCheckerName(currentRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Mariam Ali (Checker)');
    addAuditLog('APPROVE_TRANSFER', 'TRANSFER_SHEET', 'sheet-1', { status: 'APPROVED' });
  };

  // Checklist Completion
  const handleToggleChecklist = (itemId: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: true,
              completedBy: 'user-ops-1',
              completedByName: currentRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Ahmed Hassan (Maker)',
              completedAt: new Date().toISOString(),
            }
          : c
      )
    );
    addAuditLog('CHECKLIST_COMPLETE', 'CHECKLIST_ITEM', itemId);
  };

  // Super Admin Reopen Checklist
  const handleReopenChecklist = (itemId: string, reason: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId
          ? {
              ...c,
              isCompleted: false,
              reopenedBy: 'user-admin-1',
              reopenedByName: 'Super Administrator',
              reopenedAt: new Date().toISOString(),
              reopenReason: reason,
            }
          : c
      )
    );
    addAuditLog('REOPEN_CHECKLIST', 'CHECKLIST_ITEM', itemId, { reason });
  };

  // Resolve Exception
  const handleResolveException = (id: string) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex))
    );
    addAuditLog('RESOLVE_EXCEPTION', 'EXCEPTION_RECORD', id);
  };

  // Add Reference Data
  const handleAddReferenceData = (item: Omit<ReferenceData, 'id'>) => {
    const newItem: ReferenceData = { ...item, id: `ref-${Date.now()}` };
    setReferenceDataList((prev) => [newItem, ...prev]);
    addAuditLog('CREATE_REFERENCE_DATA', 'REFERENCE_DATA', newItem.id, { symbolCode: newItem.symbolCode });
  };

  // Update NAV Price
  const handleUpdateNavPrice = (id: string, newPrice: number) => {
    setReferenceDataList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, navUnitPrice: newPrice } : r))
    );
    addAuditLog('UPDATE_NAV_PRICE', 'REFERENCE_DATA', id, { newPrice });
  };

  const pendingReviewsCount = reviewStatus === 'UNDER_REVIEW' ? 1 : 0;
  const openExceptionsCount = exceptions.filter((e) => e.status === 'OPEN').length;
  const existingHashes = uploadedFiles.map((f) => f.fileHashSha256);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Navigation Header */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
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
            currentRole={currentRole}
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
            currentRole={currentRole}
            onToggleComplete={handleToggleChecklist}
            onReopenItem={handleReopenChecklist}
          />
        )}

        {activeTab === 'exceptions' && (
          <ExceptionCenter exceptions={exceptions} onResolveException={handleResolveException} />
        )}

        {activeTab === 'audit' && <AuditTrailViewer logs={auditLogs} />}

        {activeTab === 'admin' && currentRole === 'SUPER_ADMIN' && (
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
