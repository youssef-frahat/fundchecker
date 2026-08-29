// Generated Transaction Reports Component (White & Emerald Green Theme with Enterprise Command Bar)

'use client';

import React, { useState } from 'react';
import { Download, Layers, FileSpreadsheet } from 'lucide-react';
import { GeneratedTransactionRow } from '@/lib/types';
import { exportSingleFundTransactionSheet, exportTransactionSheetsPerProduct } from '@/lib/excel-engine';

interface TransactionReportTableProps {
  rows: GeneratedTransactionRow[];
}

export function TransactionReportTable({ rows }: TransactionReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const products = Array.from(new Set(rows.map((r) => r.productName))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const [activeTab, setActiveTab] = useState<string>(products[0] || 'All');

  // Category classification helper
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'T0_CASH' | 'T1_EQUITY' | 'GOLD' | 'USD'>('ALL');
  const [fundSearch, setFundSearch] = useState('');

  // Calculate Fund KPIs for selected fund
  const activeFundRows = activeTab === 'All' ? rows : rows.filter((r) => r.productName === activeTab);
  const activeBuyTotal = activeFundRows
    .filter((r) => r.transactionType?.toLowerCase() === 'buy')
    .reduce((acc, r) => acc + (r.transactionValue || 0), 0);
  const activeSellTotal = activeFundRows
    .filter((r) => r.transactionType?.toLowerCase() === 'sell')
    .reduce((acc, r) => acc + (r.transactionValue || 0), 0);
  const activeNetBalance = activeSellTotal - activeBuyTotal;

  const categorizedProducts = products.filter((prod) => {
    const pLower = prod.toLowerCase();
    if (selectedCategory === 'T0_CASH') {
      return pLower.includes('cash') || pLower.includes('money') || pLower.includes('horus') || pLower.includes('tamayoz') || pLower.includes('al-siola');
    }
    if (selectedCategory === 'T1_EQUITY') {
      return pLower.includes('equity') || pLower.includes('foras') || pLower.includes('egx') || pLower.includes('wethaq') || pLower.includes('shariah') || pLower.includes('wafra');
    }
    if (selectedCategory === 'GOLD') {
      return pLower.includes('gold') || pLower.includes('dahab') || pLower.includes('sabayek') || pLower.includes('silver');
    }
    if (selectedCategory === 'USD') {
      return pLower.includes('usd');
    }
    return true;
  }).filter((prod) => {
    if (!fundSearch.trim()) return true;
    return prod.toLowerCase().includes(fundSearch.toLowerCase());
  });

  const filteredRows = rows.filter((r) => {
    const matchesTab = activeTab === 'All' || r.productName === activeTab;
    const matchesSearch =
      r.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.externalCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleExportAllExcel = async () => {
    const blob = await exportTransactionSheetsPerProduct(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `All_Transaction_Reports_${new Date().toISOString().split('T')[0]}_v1.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportSingleFund = async (productName: string) => {
    const blob = await exportSingleFundTransactionSheet(rows, productName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = productName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${safeName}_Transaction_Sheet_${new Date().toISOString().split('T')[0]}_v1.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Generated Fund Transaction Files
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Enterprise Command Bar: Select from {products.length} operational funds. View dynamic settlement rules and granular per-fund exports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by ID or Client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-48"
          />

          {activeTab !== 'All' && (
            <button
              onClick={() => handleExportSingleFund(activeTab)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download &quot;{activeTab.substring(0, 16)}...&quot; Sheet
            </button>
          )}

          <button
            onClick={handleExportAllExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Export All {products.length} Sheets (.xlsx)
          </button>
        </div>
      </div>

      {/* Enterprise Fund Command Bar (Scalable for 50+ Funds without Horizontal Scrolling) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Category:</span>
            {([
              { key: 'ALL', label: `All Funds (${products.length})` },
              { key: 'T0_CASH', label: 'T0 Money Market' },
              { key: 'T1_EQUITY', label: 'T1 Equity' },
              { key: 'GOLD', label: 'Gold & Commodities' },
              { key: 'USD', label: 'USD Funds' },
            ] as const).map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  setSelectedCategory(cat.key);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedCategory === cat.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Fund Search inside dropdown */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Quick search fund..."
              value={fundSearch}
              onChange={(e) => setFundSearch(e.target.value)}
              className="bg-white border border-slate-300 px-2.5 py-1 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-36"
            />
          </div>
        </div>

        {/* Scalable Fund Selector Dropdown & Live Financial Snapshot */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-slate-200/80">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Active Fund:</label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="bg-white border-2 border-emerald-600 text-emerald-900 font-bold px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-md w-full shadow-sm"
            >
              <option value="All">All Operations ({rows.length} total orders)</option>
              {categorizedProducts.map((prod) => {
                const count = rows.filter((r) => r.productName === prod).length;
                return (
                  <option key={prod} value={prod}>
                    {prod} — ({count} orders)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Instant Financial KPI Badges for Selected Fund */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span className="text-slate-500 font-medium">Orders:</span>
              <span className="font-bold text-slate-900">{activeFundRows.length}</span>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span className="text-emerald-700 font-medium">Buy:</span>
              <span className="font-bold text-emerald-700">EGP {activeBuyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span className="text-rose-700 font-medium">Sell:</span>
              <span className="font-bold text-rose-700">EGP {activeSellTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 ${
              activeNetBalance >= 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span>Net:</span>
              <span>
                {activeNetBalance < 0
                  ? `(${Math.abs(activeNetBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
                  : activeNetBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 11-Column Transaction Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Transaction ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Transaction Date</th>
              <th className="p-3">External Code</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3 text-right">Transaction Value</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-center">Branch ID</th>
              <th className="p-3">Value Date</th>
              <th className="p-3 text-center">Fees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500 font-sans">
                  No transaction records match the selected tab or search query.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-emerald-700">{row.transactionId}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        row.transactionType === 'buy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {row.transactionType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{row.transactionDate}</td>
                  <td className="p-3 text-slate-700">{row.externalCode}</td>
                  <td className="p-3 font-sans text-slate-900 max-w-xs truncate">{row.name}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">
                    {row.transactionValue !== null ? (
                      row.transactionValue.toLocaleString('en-US', { minimumFractionDigits: 2 })
                    ) : (
                      <span className="text-slate-400 italic font-sans text-[11px]">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-900">
                    {row.qty !== null ? (
                      row.qty.toLocaleString('en-US')
                    ) : (
                      <span className="text-slate-400 italic font-sans text-[11px]">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-center text-slate-600">{row.branchId}</td>
                  <td className="p-3 text-slate-600">{row.valueDate}</td>
                  <td className="p-3 text-center text-slate-600">{row.fees}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
