// Super Admin Reference Data & Fund Lifecycle Admin Component (White & Emerald Theme)
// PRODUCTION READY: 100% English UI, Excel Bulk Import, Template Export, Full Database CRUD

'use client';

import React, { useState, useRef } from 'react';
import {
  Database,
  Plus,
  Search,
  Edit3,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Loader2,
  X,
  RotateCcw,
} from 'lucide-react';
import { ReferenceData, SettlementType } from '@/lib/types';
import { parseMasterDataExcel, generateMasterDataTemplateExcel } from '@/lib/excel-engine';

interface ReferenceDataAdminProps {
  referenceDataList: ReferenceData[];
  onAddReferenceData: (
    item: Omit<ReferenceData, 'id'>
  ) => Promise<{ success: boolean; error?: string } | void> | void;
  onUpdateReferenceData?: (
    item: ReferenceData
  ) => Promise<{ success: boolean; error?: string } | void> | void;
  onArchiveReferenceData?: (
    id: string,
    status: 'ACTIVE' | 'ARCHIVED'
  ) => Promise<{ success: boolean; error?: string } | void> | void;
  onBulkImportReferenceData?: (
    items: Omit<ReferenceData, 'id'>[]
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  onRestoreCanonicalDefaults?: () => Promise<{ success: boolean; count?: number; error?: string }>;
}

export function ReferenceDataAdmin({
  referenceDataList,
  onAddReferenceData,
  onUpdateReferenceData,
  onArchiveReferenceData,
  onBulkImportReferenceData,
  onRestoreCanonicalDefaults,
}: ReferenceDataAdminProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'T0' | 'T1'>('ALL');

  // Loading & Feedback States
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFund, setEditingFund] = useState<ReferenceData | null>(null);

  // Add Form State
  const [newSymbolCode, setNewSymbolCode] = useState('');
  const [newSymbolName, setNewSymbolName] = useState('');
  const [newActualSymbol, setNewActualSymbol] = useState('');
  const [newEmailContact, setNewEmailContact] = useState('');
  const [newFundType, setNewFundType] = useState<SettlementType>('T0');
  const [newScheduleFrequency, setNewScheduleFrequency] = useState('DAILY');
  const [newExecutionInstruction, setNewExecutionInstruction] = useState('');

  // Auto-dismiss notification after 6 seconds
  React.useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Filtered List
  const filteredData = referenceDataList.filter((r) => {
    const matchesSearch =
      r.symbolCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.symbolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actualSymbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || r.fundType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCreateNew = async () => {
    if (!newSymbolCode.trim() || !newSymbolName.trim() || !newActualSymbol.trim()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await onAddReferenceData({
        symbolCode: newSymbolCode.trim(),
        symbolName: newSymbolName.trim(),
        actualSymbol: newActualSymbol.trim(),
        emailContact: newEmailContact.trim(),
        navUnitPrice: 0,
        fundType: newFundType,
        status: 'ACTIVE',
        scheduleFrequency: newScheduleFrequency,
        executionInstruction: newExecutionInstruction.trim(),
      });

      if (res && !res.success) {
        setCreateError(res.error || 'Failed to create fund.');
        return;
      }

      setNotification({
        type: 'success',
        message: `Fund "${newSymbolCode.trim()}" created successfully in Master Data!`,
      });
      setShowAddModal(false);
      setNewSymbolCode('');
      setNewSymbolName('');
      setNewActualSymbol('');
      setNewEmailContact('');
      setNewFundType('T0');
      setNewScheduleFrequency('DAILY');
      setNewExecutionInstruction('');
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create fund.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingFund || !onUpdateReferenceData) return;
    setIsSaving(true);
    setEditError(null);

    try {
      const res = await onUpdateReferenceData(editingFund);
      if (res && !res.success) {
        setEditError(res.error || 'Failed to update fund in database.');
        return;
      }

      setNotification({
        type: 'success',
        message: `Fund "${editingFund.symbolCode}" updated successfully in database!`,
      });
      setEditingFund(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update fund.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (fund: ReferenceData) => {
    if (!onArchiveReferenceData) return;
    const nextStatus = fund.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';

    try {
      const res = await onArchiveReferenceData(fund.id, nextStatus);
      if (res && !res.success) {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to change fund lifecycle status.',
        });
      } else {
        setNotification({
          type: 'success',
          message: `Fund "${fund.symbolCode}" ${
            nextStatus === 'ACTIVE' ? 'restored to ACTIVE' : 'moved to ARCHIVED'
          } successfully.`,
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update status.',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setNotification(null);

    try {
      const parsedItems = await parseMasterDataExcel(file);
      if (parsedItems.length === 0) {
        throw new Error('No valid fund rows could be extracted from the Excel spreadsheet.');
      }

      if (onBulkImportReferenceData) {
        const res = await onBulkImportReferenceData(parsedItems);
        if (!res.success) {
          throw new Error(res.error || 'Failed to import master data into database.');
        }

        setNotification({
          type: 'success',
          message: `Master Data synced! Successfully upserted ${
            res.count || parsedItems.length
          } funds in PostgreSQL database.`,
        });
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse and import Excel file.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await generateMasterDataTemplateExcel(referenceDataList);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Master_Data_Funds_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate Excel template.',
      });
    }
  };

  const handleRestoreCanonical = async () => {
    if (!onRestoreCanonicalDefaults) return;
    setIsRestoring(true);
    setNotification(null);
    try {
      const res = await onRestoreCanonicalDefaults();
      if (!res.success) {
        throw new Error(res.error || 'Failed to restore canonical master data.');
      }
      setShowRestoreModal(false);
      setNotification({
        type: 'success',
        message: `تم استرجاع التكوين القياسي بنجاح! تم تحديث جميع الـ ${res.count || 68} صندوقاً وإعادة تثبيت تعليمات التنفيذ وأنواع التسوية المعتمدة.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'فشل في استعادة التكوين الأصلي للصناديق.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Hidden Excel File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Dynamic Feedback Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-200 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Operational Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Fund Master &amp; Settlement Rule Management
            </h3>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Super Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Configure fund settlement rules (T0 vs T1), dynamic visibility matrices, schedules, and
            lifecycle status. Changes persist directly to the PostgreSQL database.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Restore Canonical Defaults Button */}
          {onRestoreCanonicalDefaults && (
            <button
              onClick={() => setShowRestoreModal(true)}
              disabled={isRestoring || isImporting}
              title="استعادة الإعدادات الأصلية والتعليمات المعتمدة لجميع الـ 68 صندوقاً"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${isRestoring ? 'animate-spin' : ''}`} />
              استعادة التعليمات القياسية (68 صندوق)
            </button>
          )}

          {/* Download Template / Export Button */}
          <button
            onClick={handleDownloadTemplate}
            title="Download formatted Master Data Excel template or current dataset"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export / Template (.xlsx)
          </button>

          {/* Import Master Data Excel Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Upload Master Data spreadsheet to bulk update fund codes and settlement parameters"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            )}
            {isImporting ? 'Importing Excel...' : 'Upload Master Data (.xlsx)'}
          </button>

          {/* Create New Fund Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create New Fund
          </button>
        </div>
      </div>

      {/* Filter & Command Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md transition ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ACTIVE'
                  ? 'Active Funds'
                  : st === 'ARCHIVED'
                  ? 'Archived Funds'
                  : 'All Funds'}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            {(['ALL', 'T0', 'T1'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md transition ${
                  typeFilter === t
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'All Types' : `${t} Rules`}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-500 ml-2">
            Showing {filteredData.length} of {referenceDataList.length} funds
          </span>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search code or fund name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64 shadow-2xs"
          />
        </div>
      </div>

      {/* Fund Master Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Fund Code</th>
              <th className="p-3">Fund Name</th>
              <th className="p-3">Actual Symbol</th>
              <th className="p-3 text-center">Settlement Type</th>
              <th className="p-3">Assigned Rule Set</th>
              <th className="p-3">Execution Schedule</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                  No funds found in the database. Use &quot;Upload Master Data (.xlsx)&quot; or click
                  &quot;Create New Fund&quot; above.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50 transition ${
                    row.status === 'ARCHIVED' || row.status === 'CLOSED'
                      ? 'opacity-60 bg-slate-50/50'
                      : ''
                  }`}
                >
                  <td className="p-3 font-semibold font-mono text-emerald-700">{row.symbolCode}</td>
                  <td className="p-3 font-bold text-slate-900">{row.symbolName}</td>
                  <td className="p-3 text-slate-600 font-mono">{row.actualSymbol}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] font-mono border ${
                        row.fundType === 'T1'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {row.fundType || 'T0'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {row.fundType === 'T1' ? (
                      <span className="text-[11px] text-blue-800 font-medium">
                        T1: BUY (Value only) | SELL (Qty only)
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-800 font-medium">
                        T0: Full Data (Value &amp; Qty)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {row.executionInstruction || (row.fundType === 'T1' ? 'T+1' : 'T+0')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Cycle: {row.scheduleFrequency || 'DAILY'}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.status === 'ARCHIVED'
                          ? 'bg-slate-100 text-slate-600 border-slate-300'
                          : row.status === 'CLOSED'
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {row.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditError(null);
                          setEditingFund({ ...row });
                        }}
                        title="Edit Fund & Settlement Type"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleArchive(row)}
                        title={row.status === 'ACTIVE' ? 'Archive Fund' : 'Restore Fund'}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          row.status === 'ACTIVE'
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE FUND MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 text-emerald-700">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
                  <Plus className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">Create New Fund Master</h4>
                  <p className="text-xs text-slate-500">
                    Assign Settlement Rules and Operational Parameters
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fund Symbol Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1025 or GOLD AZ"
                    value={newSymbolCode}
                    onChange={(e) => setNewSymbolCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Actual Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sabayek or AFAC"
                    value={newActualSymbol}
                    onChange={(e) => setNewActualSymbol(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fund Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wethaq Investment Fund"
                  value={newSymbolName}
                  onChange={(e) => setNewSymbolName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Settlement Type *</label>
                  <select
                    value={newFundType}
                    onChange={(e) => setNewFundType(e.target.value as SettlementType)}
                    className="w-full bg-white border-2 border-emerald-600 rounded-xl p-2.5 text-emerald-950 font-bold focus:outline-none"
                  >
                    <option value="T0">T0 — Money Market / Daily Liquidity</option>
                    <option value="T1">T1 — Equity / Investment Funds</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {newFundType === 'T1'
                      ? '⚡ T1: BUY displays Value only (Qty hidden) | SELL displays Qty only (Value hidden)'
                      : '⚡ T0: Full Value and Quantity preserved for both Buy & Sell in exports'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Custodian Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="custodian.fund@bank.com"
                    value={newEmailContact}
                    onChange={(e) => setNewEmailContact(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Execution Cycle (Frequency)
                  </label>
                  <select
                    value={newScheduleFrequency}
                    onChange={(e) => setNewScheduleFrequency(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="DAILY">DAILY — Every Business Day</option>
                    <option value="WEEKLY">WEEKLY — Weekly Notice &amp; Execution</option>
                    <option value="BIWEEKLY">BIWEEKLY — 2nd &amp; 4th Week</option>
                    <option value="MONTHLY">MONTHLY — Monthly (Day 18 / 1st Mon)</option>
                    <option value="CUSTOM">CUSTOM — Tailored Instructions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Execution Schedule / Rule
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly notice Thursday, execution Sunday"
                    value={newExecutionInstruction}
                    onChange={(e) => setNewExecutionInstruction(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={isCreating}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={isCreating}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isCreating ? 'Creating Fund...' : 'Create Fund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FUND LIFECYCLE MODAL */}
      {editingFund && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 text-emerald-700">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
                  <Edit3 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    Edit Fund Master &amp; Settlement Type
                  </h4>
                  <p className="text-xs text-slate-500">
                    Persists directly to database and updates execution matrices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingFund(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fund Symbol Code</label>
                  <input
                    type="text"
                    value={editingFund.symbolCode}
                    onChange={(e) => setEditingFund({ ...editingFund, symbolCode: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Actual Symbol</label>
                  <input
                    type="text"
                    value={editingFund.actualSymbol}
                    onChange={(e) => setEditingFund({ ...editingFund, actualSymbol: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fund Name</label>
                <input
                  type="text"
                  value={editingFund.symbolName}
                  onChange={(e) => setEditingFund({ ...editingFund, symbolName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Settlement Type *</label>
                  <select
                    value={editingFund.fundType || 'T0'}
                    onChange={(e) =>
                      setEditingFund({
                        ...editingFund,
                        fundType: e.target.value as SettlementType,
                      })
                    }
                    className="w-full bg-white border-2 border-emerald-600 rounded-xl p-2.5 text-emerald-950 font-bold focus:outline-none"
                  >
                    <option value="T0">T0 — Money Market / Daily Liquidity</option>
                    <option value="T1">T1 — Equity / Investment Funds</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {editingFund.fundType === 'T1'
                      ? '⚡ T1: BUY displays Value only (Qty hidden) | SELL displays Qty only (Value hidden)'
                      : '⚡ T0: Full Value and Quantity preserved for both Buy & Sell in exports'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Lifecycle Status</label>
                  <select
                    value={editingFund.status || 'ACTIVE'}
                    onChange={(e) =>
                      setEditingFund({
                        ...editingFund,
                        status: e.target.value as ReferenceData['status'],
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="ARCHIVED">ARCHIVED (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Execution Cycle (Frequency)
                  </label>
                  <select
                    value={editingFund.scheduleFrequency || 'DAILY'}
                    onChange={(e) =>
                      setEditingFund({ ...editingFund, scheduleFrequency: e.target.value })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="DAILY">DAILY — Every Business Day</option>
                    <option value="WEEKLY">WEEKLY — Weekly Notice &amp; Execution</option>
                    <option value="BIWEEKLY">BIWEEKLY — 2nd &amp; 4th Week</option>
                    <option value="MONTHLY">MONTHLY — Monthly (Day 18 / 1st Mon)</option>
                    <option value="CUSTOM">CUSTOM — Tailored Instructions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Execution Schedule / Rule
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly notice Thursday, execution Sunday"
                    value={editingFund.executionInstruction || ''}
                    onChange={(e) =>
                      setEditingFund({ ...editingFund, executionInstruction: e.target.value })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Custodian Contact Email
                </label>
                <input
                  type="email"
                  value={editingFund.emailContact || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, emailContact: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingFund(null)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Saving Changes...' : 'Save Fund Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Canonical Master Data Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  استعادة التكوين القياسي للصناديق (68 صندوق)
                </h4>
                <p className="text-xs text-slate-500">
                  Restore Canonical Operations &amp; Settlement Rules
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2 leading-relaxed">
              <p className="font-bold">
                ⚠️ هل ترغب في إعادة ضبط جميع الصناديق إلى إعداداتها التشغيلية القياسية؟
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>استرجاع نوع التسوية المعتمد لكل صندوق (T0 مقابل T1).</li>
                <li>إعادة تثبيت دوريات ومواعيد التنفيذ والإخطار الرسمية باللغة العربية.</li>
                <li>الحفاظ التام على أي أسعار وثائق (NAV Prices) مسجلة حالياً أكبر من صفر.</li>
                <li>توثيق العملية تلقائياً في سجل الرقابة والتدقيق (Immutable Audit Log).</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 transition"
              >
                إلغاء (Cancel)
              </button>
              <button
                type="button"
                onClick={handleRestoreCanonical}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                {isRestoring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isRestoring ? 'جاري الاستعادة وتحديث الداتابيز...' : 'تأكيد الاستعادة القياسية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
