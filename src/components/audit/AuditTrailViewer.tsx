// Audit Trail Viewer Component (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import { Lock, Search } from 'lucide-react';
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Immutable System Audit Trail
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
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
            className="bg-slate-50 border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Log ID</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target Entity</th>
              <th className="p-3">IP Address</th>
              <th className="p-3">Timestamp (Cairo / UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-emerald-700">{log.id}</td>
                  <td className="p-3 font-sans text-slate-900">{log.userName}</td>
                  <td className="p-3">
                    <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{log.entityName}</td>
                  <td className="p-3 text-slate-600">{log.ipAddress}</td>
                  <td className="p-3 text-slate-700">
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
