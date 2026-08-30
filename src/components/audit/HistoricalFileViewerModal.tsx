'use client';

import React, { useEffect, useState } from 'react';
import { X, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import { UploadedFileRecord, RawTransactionRow, TransferSheetLine } from '@/lib/types';
import { fetchHistoricalFileRowsAction } from '@/app/actions/workspaceActions';
import { exportTransactionSheetsPerProduct } from '@/lib/excel-engine';

interface HistoricalFileViewerModalProps {
  fileRecord: UploadedFileRecord;
  onClose: () => void;
}

export function HistoricalFileViewerModal({ fileRecord, onClose }: HistoricalFileViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RawTransactionRow[]>([]);
  const [lines, setLines] = useState<TransferSheetLine[]>([]);
  const [isAllocation, setIsAllocation] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      const res = await fetchHistoricalFileRowsAction(fileRecord.id);
      if (!isMounted) return;
      if (!res.success) {
        setError(res.error || 'Failed to load historical sheet records.');
      } else {
        setRows(res.rows || []);
        setLines(res.lines || []);
        setIsAllocation(Boolean(res.isAllocation));
      }
      setLoading(false);
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [fileRecord.id]);

  const filteredOrders = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.requestId.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.symbol.toLowerCase().includes(q) ||
      r.mubasherNo.toLowerCase().includes(q)
    );
  });

  const filteredLines = lines.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.symbolCode.toLowerCase().includes(q) ||
      l.symbolName.toLowerCase().includes(q) ||
      (l.actualSymbol && l.actualSymbol.toLowerCase().includes(q))
    );
  });

  const handleExportReconstructedExcel = async () => {
    if (isAllocation || rows.length === 0) return;
    const generatedRows: import('@/lib/types').GeneratedTransactionRow[] = rows.map((r) => ({
      transactionId: r.requestId,
      transactionType: (r.orderSide.toLowerCase() === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
      transactionDate: r.orderDate ? r.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
      externalCode: r.mubasherNo || r.symbol,
      name: r.customerName,
      transactionValue: r.orderValue,
      qty: r.quantity,
      branchId: 1,
      valueDate: r.orderDate ? r.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
      icPrice: r.price,
      fees: 0,
      productName: r.symbolDescription || r.symbol,
    }));

    const blob = await exportTransactionSheetsPerProduct(generatedRows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historical_${fileRecord.fileName.replace(/\.[^/.]+$/, '')}_Audit.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100/70 text-emerald-700 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{fileRecord.fileName}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    fileRecord.fileCategory === 'ALLOCATION'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {fileRecord.fileCategory || 'ORDERS'}
                  </span>
                  <span className="text-[10px] font-semibold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
                    {fileRecord.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  SHA-256: {fileRecord.fileHashSha256 ? `${fileRecord.fileHashSha256.substring(0, 16)}...` : 'N/A'} • Uploaded: {new Date(fileRecord.uploadedAt).toLocaleString('en-US', { timeZone: 'Africa/Cairo' })} (Cairo)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAllocation && rows.length > 0 && (
              <button
                onClick={handleExportReconstructedExcel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export Clean (.xlsx)
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Metadata Bar */}
        <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <span>
              Total Stored Rows: <strong className="text-slate-900">{isAllocation ? lines.length : rows.length}</strong>
            </span>
            <span>•</span>
            <span>
              Uploaded By: <strong className="text-slate-900">{fileRecord.uploadedByName || 'Operations'}</strong>
            </span>
          </div>

          <input
            type="text"
            placeholder="Filter table records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64 shadow-2xs"
          />
        </div>

        {/* Modal Content / Table Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-sm font-medium">Loading verified historical sheet records from PostgreSQL...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
              {error}
            </div>
          ) : isAllocation ? (
            /* Cash Netting Allocation Lines View */
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-purple-50 text-purple-950 font-bold uppercase text-[10px] border-b border-purple-200">
                  <tr>
                    <th className="p-3">Symbol Code</th>
                    <th className="p-3">Fund Name</th>
                    <th className="p-3 text-right">System Buy</th>
                    <th className="p-3 text-right">System Sell</th>
                    <th className="p-3 text-right">System Net</th>
                    <th className="p-3 text-right">Adjustment</th>
                    <th className="p-3 text-right">Final Transfer</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No transfer lines match search.
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold text-purple-800">{line.symbolCode}</td>
                        <td className="p-3 font-sans text-slate-900">{line.symbolName}</td>
                        <td className="p-3 text-right text-emerald-700 font-semibold">
                          {line.systemBuyAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-rose-700 font-semibold">
                          {line.systemSellAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {line.systemNetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-amber-700 font-semibold">
                          {line.adjustmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-800 bg-emerald-50/40">
                          {line.finalTransferAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          {line.isManuallyAdjusted ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              ADJUSTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              SYSTEM
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Orders Transactions View */
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Req ID</th>
                    <th className="p-3">Mubasher No</th>
                    <th className="p-3">Side</th>
                    <th className="p-3">Symbol</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Order Value</th>
                    <th className="p-3 text-right">Net Settle</th>
                    <th className="p-3">Order Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                        No orders match search.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold text-emerald-700">{ord.requestId}</td>
                        <td className="p-3 text-slate-600">{ord.mubasherNo || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ord.orderSide.toUpperCase() === 'BUY'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {ord.orderSide}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{ord.symbol}</td>
                        <td className="p-3 font-sans text-slate-800 max-w-[200px] truncate">{ord.customerName}</td>
                        <td className="p-3 text-right font-semibold">
                          {ord.quantity.toLocaleString('en-US')}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {ord.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {ord.orderValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700">
                          {(ord.netSettle ?? ord.orderValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {ord.orderDate ? ord.orderDate.split('T')[0] : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-sans">
          <span>Forensic Ingestion Audit • Immutable Historical Archive</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition shadow-sm"
          >
            Close Sheet Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
