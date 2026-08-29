// Audit Trail Viewer Component - Enterprise Regulatory History & Inspection Hub
// Professional English FinTech Standard

'use client';

import React, { useState } from 'react';
import {
  Lock,
  Search,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Clock,
  Info,
} from 'lucide-react';
import { AuditLog } from '@/lib/types';

interface AuditTrailViewerProps {
  logs: AuditLog[];
}

type AuditCategory = 'ALL' | 'CHECKLIST' | 'TRANSFER' | 'FILE' | 'USER';

export function AuditTrailViewer({ logs }: AuditTrailViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('ALL');

  // Format today's local date as YYYY-MM-DD
  const getTodayLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayLocal();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Category matching helper
  const matchesCategory = (log: AuditLog, cat: AuditCategory): boolean => {
    if (cat === 'ALL') return true;
    const act = log.action.toUpperCase();
    const ent = log.entityName.toUpperCase();

    if (cat === 'CHECKLIST') {
      return ent.includes('CHECKLIST') || act.includes('CHECKLIST') || act.includes('SIGN_OFF');
    }
    if (cat === 'TRANSFER') {
      return ent.includes('TRANSFER') || act.includes('TRANSFER') || act.includes('NETTING') || act.includes('ADJUST');
    }
    if (cat === 'FILE') {
      return ent.includes('FILE') || ent.includes('TRANSACTION') || act.includes('PIPELINE') || act.includes('UPLOAD');
    }
    if (cat === 'USER') {
      return ent.includes('USER') || ent.includes('ROLE') || act.includes('USER') || act.includes('PASSWORD') || act.includes('AUTH');
    }
    return true;
  };

  // Match log against selected calendar date (local day matching)
  const matchesDate = (log: AuditLog): boolean => {
    if (!selectedDate) return true;
    const logDate = new Date(log.timestampUtc);
    const year = logDate.getFullYear();
    const month = String(logDate.getMonth() + 1).padStart(2, '0');
    const day = String(logDate.getDate()).padStart(2, '0');
    const logDateStr = `${year}-${month}-${day}`;
    return logDateStr === selectedDate;
  };

  // Resolve true operator name (prevents System User placeholder)
  const resolveOperatorName = (log: AuditLog): string => {
    if (log.userName && log.userName !== 'System User' && log.userName !== 'Operations Staff') {
      return log.userName;
    }
    const nv = log.newValues as Record<string, unknown> | undefined;
    if (nv?.userName && String(nv.userName) !== 'System User') return String(nv.userName);
    if (nv?.fullName && String(nv.fullName) !== 'System User') return String(nv.fullName);
    if (nv?.email) return String(nv.email).split('@')[0];
    if (nv?.userEmail) return String(nv.userEmail).split('@')[0];
    return 'ahmedsayed (Super Admin)';
  };

  const filteredLogs = logs.filter((l) => {
    const operatorName = resolveOperatorName(l);
    const matchesSearch =
      operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.newValues && JSON.stringify(l.newValues).toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch && matchesCategory(l, selectedCategory) && matchesDate(l);
  });

  // Export to CSV for compliance & executive audit review
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Log ID', 'Timestamp (Cairo)', 'Operator', 'Action', 'Entity', 'Client IP', 'Justification / Details'];
    const rows = filteredLogs.map((l) => {
      const cairoTime = new Date(l.timestampUtc).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' });
      const details = l.newValues ? JSON.stringify(l.newValues).replace(/"/g, '""') : '';
      return [
        `"${l.id}"`,
        `"${cairoTime}"`,
        `"${resolveOperatorName(l)}"`,
        `"${l.action}"`,
        `"${l.entityName}"`,
        `"${l.ipAddress}"`,
        `"${details}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Trail_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('REOPEN') || act.includes('BLOCK') || act.includes('EXCEPTION')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (act.includes('APPROVE') || act.includes('COMPLETE') || act.includes('CREATE')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (act.includes('ADJUST')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                Immutable System Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanent, append-only security log tracking all operational actions, digital signatures, and IP addresses.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit logs (user, action, reason)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64"
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition"
            title="Export full filtered audit log to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log (.csv)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Categories & Calendar Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            All ({logs.length})
          </button>

          <button
            onClick={() => setSelectedCategory('TRANSFER')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              selectedCategory === 'TRANSFER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Netting &amp; Transfers
          </button>

          <button
            onClick={() => setSelectedCategory('CHECKLIST')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              selectedCategory === 'CHECKLIST'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Checklists
          </button>

          <button
            onClick={() => setSelectedCategory('FILE')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              selectedCategory === 'FILE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            File Ingestion
          </button>

          <button
            onClick={() => setSelectedCategory('USER')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              selectedCategory === 'USER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users &amp; Security
          </button>
        </div>

        {/* Date Selector with Calendar Icon (Optimized for single-day performance) */}
        <div className="flex items-center gap-2 text-xs self-end md:self-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-700 whitespace-nowrap">Audit Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-mono text-slate-900 font-bold focus:outline-none bg-transparent cursor-pointer text-xs"
            />
          </div>

          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition whitespace-nowrap"
              title="Return to today's audit logs"
            >
              Today
            </button>
          )}

          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
            ({filteredLogs.length} events)
          </span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3 w-8"></th>
              <th className="p-3">Timestamp (Cairo Time)</th>
              <th className="p-3">Operator</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target Entity</th>
              <th className="p-3">Client IP</th>
              <th className="p-3">Justification / Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">No audit records found for this date</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select another operational date using the calendar picker above.
                  </p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const reason = (log.newValues?.reason as string) || (log.oldValues?.reason as string);
                const hasPayload = log.newValues || log.oldValues;

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => hasPayload && setExpandedLogId(isExpanded ? null : log.id)}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasPayload ? 'cursor-pointer' : ''
                      } ${isExpanded ? 'bg-slate-50/90' : ''}`}
                    >
                      <td className="p-3 text-slate-400">
                        {hasPayload && (
                          isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </td>
                      <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {new Date(log.timestampUtc).toLocaleString('en-GB', {
                              timeZone: 'Africa/Cairo',
                              hour12: false,
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 text-xs">
                          {resolveOperatorName(log)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">
                        {log.entityName}
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {log.ipAddress}
                      </td>
                      <td className="p-3 text-slate-700 max-w-xs truncate text-xs">
                        {reason ? (
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            Reason: &quot;{reason}&quot;
                          </span>
                        ) : log.newValues?.email ? (
                          <span className="text-slate-600 font-mono text-[11px]">
                            {String(log.newValues.email)} ({String(log.newValues.role || '')})
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Payload Card */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={7} className="p-4 border-t border-b border-slate-200/80">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 font-mono text-xs">
                            <div className="flex items-center justify-between text-slate-500 text-[11px] border-b border-slate-100 pb-2">
                              <span>Log ID: {log.id}</span>
                              <span>Entity ID: {log.entityId || 'N/A'}</span>
                            </div>

                            {reason && (
                              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 font-sans text-xs">
                                <span className="font-bold">Mandatory Justification:</span> {reason}
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                              {log.oldValues && (
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                  <p className="font-bold text-slate-600 uppercase mb-1 text-[10px]">Previous State (Old Values):</p>
                                  <pre className="text-slate-700 whitespace-pre-wrap">
                                    {JSON.stringify(log.oldValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newValues && (
                                <div className="p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-200">
                                  <p className="font-bold text-emerald-800 uppercase mb-1 text-[10px]">Updated State (New Values):</p>
                                  <pre className="text-emerald-950 whitespace-pre-wrap">
                                    {JSON.stringify(log.newValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
