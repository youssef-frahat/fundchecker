// Audit Trail Viewer Component - Immutable Log Inspection

'use client';

import React, { useState } from 'react';
import { Lock, Search, ShieldCheck, Clock, FileText } from 'lucide-react';
import { AuditLog } from '@/lib/types';

interface AuditTrailViewerProps {
  logs: AuditLog[];
}

export function AuditTrailViewer({ logs }: AuditTrailViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entityName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-slate-100">
              Immutable System Audit Trail
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Database trigger enforced. Every file ingestion, review approval, reopen action, and setting change is logged permanently.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-64"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">Log ID</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target Entity</th>
              <th className="p-3">IP Address</th>
              <th className="p-3">Timestamp (Cairo / UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-emerald-400">{log.id}</td>
                  <td className="p-3 font-sans text-slate-200">{log.userName}</td>
                  <td className="p-3">
                    <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{log.entityName}</td>
                  <td className="p-3 text-slate-400">{log.ipAddress}</td>
                  <td className="p-3 text-slate-300">
                    {new Date(log.timestampUtc).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })} (Cairo)
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
