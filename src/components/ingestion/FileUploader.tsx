// Ingestion Module - File Uploader, SHA-256 Duplicate Modal & Demo File Generator

'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react';
import { computeFileHash, parseTradingExcel } from '@/lib/excel-engine';
import { RawTransactionRow, UploadedFileRecord } from '@/lib/types';
import ExcelJS from 'exceljs';

interface FileUploaderProps {
  onFileUpload: (fileRecord: UploadedFileRecord, rawRows: RawTransactionRow[]) => void;
  existingHashes: string[];
}

export function FileUploader({ onFileUpload, existingHashes }: FileUploaderProps) {
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
      // Validate size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File exceeds maximum upload threshold of 100MB.');
      }

      // Compute SHA-256 hash
      const hash = await computeFileHash(file);

      // Duplicate Hash Check
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
        uploadedBy: 'user-ops-1',
        uploadedByName: 'Ahmed Hassan (Maker)',
        uploadedAt: new Date().toISOString(),
        status: 'PARSED',
      };

      onFileUpload(fileRecord, parsedRows);
      setDuplicateModal(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error extracting trade rows.');
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

  // Generate Sample Trading File for instant UAT testing!
  const generateSampleExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sheet1');

    // Headers matching the 39 source columns
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

    // Sample Egyptian Fund Trading Rows matching user screenshot datasets
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
      {/* File Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20 scale-[1.01]'
            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
        }`}
      >
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10">
            {isProcessing ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Upload Daily Excel Trading File
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports 39-column raw trading format up to <span className="text-emerald-400 font-semibold">100MB (50,000+ rows)</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <label className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl cursor-pointer text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20">
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

            <button
              onClick={generateSampleExcel}
              disabled={isProcessing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2 border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Load Sample Trade File
            </button>
          </div>

          {/* Feature Micro-Badges */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" /> SHA-256 Hash Duplicate Check
            </span>
            <span className="flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-emerald-400" /> 39-Column Auto Validation
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="font-bold">Ingestion Error</p>
            <p className="text-rose-400/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Duplicate Hash Detection Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-100">Duplicate File Detected</h4>
                <p className="text-xs text-amber-400/90">SHA-256 Hash Conflict Identified</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 font-mono text-slate-300">
              <p><span className="text-slate-500">File Name:</span> {duplicateModal.file.name}</p>
              <p className="truncate"><span className="text-slate-500">SHA-256:</span> {duplicateModal.hash}</p>
            </div>

            <p className="text-xs text-slate-300">
              An identical file hash has already been ingested into the audit database today. Re-processing will create new report versions.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDuplicateModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => executeFileParsing(duplicateModal.file, duplicateModal.hash)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20"
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
