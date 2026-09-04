// Ingestion Module - File Uploader (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  RefreshCw,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { computeFileHash, parseTradingExcel } from '@/lib/excel-engine';
import { RawTransactionRow, UploadedFileRecord } from '@/lib/types';
import { formatUserFriendlyError } from '@/lib/error-formatter';
import ExcelJS from 'exceljs';

interface FileUploaderProps {
  onFileUpload: (fileRecord: UploadedFileRecord, rawRows: RawTransactionRow[], category: 'ORDERS' | 'ALLOCATION') => void;
  existingHashes: string[];
  uploaderEmail?: string;
  uploaderName?: string;
  defaultCategory?: 'ORDERS' | 'ALLOCATION';
  hideCategorySelector?: boolean;
}

export function FileUploader({
  onFileUpload,
  existingHashes,
  uploaderEmail,
  uploaderName,
  defaultCategory = 'ORDERS',
  hideCategorySelector = false,
}: FileUploaderProps) {
  const [fileCategory, setFileCategory] = useState<'ORDERS' | 'ALLOCATION'>(defaultCategory);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<{
    file: File;
    hash: string;
  } | null>(null);

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File exceeds maximum upload threshold of 100MB.');
      }

      const hash = await computeFileHash(file);

      // Check client-side duplicate before parsing
      if (existingHashes.includes(hash)) {
        setDuplicateModal({ file, hash });
        setIsProcessing(false);
        return;
      }

      await executeFileParsing(file, hash);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse file.');
      setIsProcessing(false);
    }
  };

  const executeFileParsing = async (file: File, hash: string) => {
    try {
      const parsedRows = await parseTradingExcel(file);
      if (parsedRows.length === 0) {
        throw new Error('No valid trading transactions found in uploaded Excel file.');
      }

      const fileRecord: UploadedFileRecord = {
        id: `file-${Date.now()}`,
        fileName: file.name,
        fileHashSha256: hash,
        fileSize: file.size,
        rowCount: parsedRows.length,
        uploadedBy: uploaderEmail || '',
        uploadedByName: uploaderName || 'Operations User',
        uploadedAt: new Date().toISOString(),
        status: 'PARSED',
      };

      onFileUpload(fileRecord, parsedRows, fileCategory);
      setDuplicateModal(null);
    } catch (err: unknown) {
      setErrorMessage(formatUserFriendlyError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const generateSampleExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sheet1');

    ws.addRow([
      'Request Id',
      'Mubasher No',
      'Customer Name',
      'Order Side',
      'Symbol',
      'Symbol Description',
      'Order Status',
      'Book Keeper',
      'Currency',
      'Quantity',
      'Price',
      'Order Value',
      'Total Commission',
      'Net Settle',
      'Cash Account No',
      'Cash Balance',
      'Portfolio Value',
      'ISIN Code',
      'Leverage %',
      'Blocked Amount',
      'Exchange No',
      'Unified Code',
      'Reject Reason',
      'Order Entered By',
      'Order Date',
    ]);

    const sampleData = [
      ['IPO260825-1-00231', '226752177', 'SHIEHAM SAAD AHMED KOTB', 'BUY', '1005', 'NI Capital Money Market', 'EXECUTED', 'MUBASHER', 'EGP', 35377, 24.02706, 850005.3016, 0, 850005.3016, 'ACC-101', 5000000, 10000000, 'EGS693R1C012', 0, 0, 'EX-1', 'UNI-1', '', 'SYS', '2026-08-25T10:00:00Z'],
      ['IPO260825-1-00278', '465928456', 'KARIM KHALED MOAHMED ELIWA', 'BUY', '1016', 'Cash Mubasher Fund', 'EXECUTED', 'MUBASHER', 'EGP', 300, 24.02706, 7208.118, 0, 7208.118, 'ACC-102', 2000000, 4000000, 'EGS693R1C013', 0, 0, 'EX-1', 'UNI-2', '', 'SYS', '2026-08-25T10:05:00Z'],
      ['IPO260825-1-00279', '307137552', 'MINA FAKTHAR GARAS WAHAB', 'BUY', 'GOLD AZ', 'AZIMUT GOLD', 'EXECUTED', 'MUBASHER', 'EGP', 1000, 24.02706, 24027.06, 0, 24027.06, 'ACC-103', 1500000, 3000000, 'EGS693R1C014', 0, 0, 'EX-1', 'UNI-3', '', 'SYS', '2026-08-25T10:10:00Z'],
      ['IPO260825-1-00047', '587485698', 'MUBASHER CAPITAL- NOT DVB', 'SELL', '1016', 'Cash Mubasher Fund', 'EXECUTED', 'MUBASHER', 'EGP', 20819, 24.02706, 500219.3621, 0, 500219.3621, 'ACC-104', 8000000, 15000000, 'EGS693R1C013', 0, 0, 'EX-1', 'UNI-4', '', 'SYS', '2026-08-25T10:15:00Z'],
      ['IPO260825-1-00222', '782200729', 'AHMED ALY ABD ELSALAM ALY', 'SELL', 'AHLAC', 'AHLY A. CONTRACTORS FUND', 'EXECUTED', 'MUBASHER', 'EGP', 40, 24.02706, 961.0824, 0, 961.0824, 'ACC-105', 900000, 1800000, 'EGS693R1C015', 0, 0, 'EX-1', 'UNI-5', '', 'SYS', '2026-08-25T10:20:00Z'],
      ['IPO260825-1-00044', '201714479', 'EMAD MOHAMED ABD EL RASOL', 'SELL', '1018', 'HORUS FUND', 'EXECUTED', 'MUBASHER', 'EGP', 3500, 24.02706, 84094.71, 0, 84094.71, 'ACC-106', 4000000, 8000000, 'EGS693R1C016', 0, 0, 'EX-1', 'UNI-6', '', 'SYS', '2026-08-25T10:25:00Z'],
      ['IPO260825-1-00217', '714416679', 'MOATAZ GHOBASHY ALI GHOBASHY', 'SELL', 'kenzshariaa', 'KENZSHARIAA', 'EXECUTED', 'MUBASHER', 'EGP', 1000, 24.02706, 24027.06, 0, 24027.06, 'ACC-107', 3000000, 6000000, 'EGS693R1C017', 0, 0, 'EX-1', 'UNI-7', '', 'SYS', '2026-08-25T10:30:00Z'],
    ];

    sampleData.forEach((row) => ws.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const file = new File([blob], 'Sample_Trading_File_20260828.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    handleProcessFile(file);
  };

  return (
    <div className="space-y-6">
      {/* File Purpose / Category Selector */}
      {!hideCategorySelector && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs">
            <span className="font-bold text-slate-900 block">Select Operational File Type:</span>
            <span className="text-slate-500">Choose whether this file is for trading transaction reports or cash transfer netting.</span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFileCategory('ORDERS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                fileCategory === 'ORDERS'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Orders File (Transactions)
            </button>
            <button
              type="button"
              onClick={() => setFileCategory('ALLOCATION')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                fileCategory === 'ALLOCATION'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Allocation File (Transfers)
            </button>
          </div>
        </div>
      )}

      {/* File Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
          isDragging
            ? 'border-emerald-600 bg-emerald-50 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-emerald-500 shadow-sm'
        }`}
      >
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700 shadow-md shadow-emerald-500/10">
            {isProcessing ? (
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            ) : (
              <UploadCloud className="w-8 h-8 text-emerald-600" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Upload Daily {fileCategory === 'ALLOCATION' ? 'Allocation' : 'Trading Orders'} File
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {fileCategory === 'ALLOCATION'
                ? 'Calculates cash transfers using Allocated Quantity × Price (Net = Sell - Buy).'
                : 'Supports 39-column raw trading format generating 11-column fund reports.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <label className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="w-4 h-4" />
              Browse Excel File
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Feature Micro-Badges */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" /> SHA-256 Hash Duplicate Check
            </span>
            <span className="flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-emerald-600" /> 39-Column Auto Validation
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Ingestion Error</p>
            <p className="text-rose-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Duplicate Hash Detection Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-amber-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Duplicate File Detected</h4>
                <p className="text-xs text-amber-700">SHA-256 Hash Conflict Identified</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 font-mono text-slate-800">
              <p><span className="text-slate-500">File Name:</span> {duplicateModal.file.name}</p>
              <p className="truncate"><span className="text-slate-500">SHA-256:</span> {duplicateModal.hash}</p>
            </div>

            <p className="text-xs text-slate-600">
              An identical file hash has already been ingested into the audit database today. Re-processing will create new report versions.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDuplicateModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => executeFileParsing(duplicateModal.file, duplicateModal.hash)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20"
              >
                Proceed &amp; Overwrite Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
