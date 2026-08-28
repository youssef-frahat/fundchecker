// Exception Center Component - Unmapped Symbol & Data Anomaly Resolution Queue

'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, UserCheck, Search, Filter } from 'lucide-react';
import { ExceptionRecord } from '@/lib/types';

interface ExceptionCenterProps {
  exceptions: ExceptionRecord[];
  onResolveException: (id: string) => void;
}

export function ExceptionCenter({ exceptions, onResolveException }: ExceptionCenterProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-lg text-slate-100">
              Operational Exception Queue
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Isolates unmapped symbols, missing fund references, or file schematic anomalies. Zero auto-processing of unmapped data.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>Open Exceptions: </span>
          <span className="text-rose-400 font-bold">
            {exceptions.filter((e) => e.status === 'OPEN').length}
          </span>
        </div>
      </div>

      {/* Exception Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">Exception ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">File Name</th>
              <th className="p-3">Error Details</th>
              <th className="p-3">Status</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                  No operational exceptions recorded. System is processing cleanly.
                </td>
              </tr>
            ) : (
              exceptions.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-rose-400">{ex.id}</td>
                  <td className="p-3">
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                      {ex.exceptionType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 font-sans">{ex.fileName}</td>
                  <td className="p-3 font-sans text-slate-200">{ex.errorMessage}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ex.status === 'RESOLVED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {ex.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(ex.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })}
                  </td>
                  <td className="p-3 text-center">
                    {ex.status === 'OPEN' ? (
                      <button
                        onClick={() => onResolveException(ex.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-lg text-[11px] transition shadow"
                      >
                        Resolve &amp; Re-parse
                      </button>
                    ) : (
                      <span className="text-emerald-400 font-semibold text-[11px]">Resolved</span>
                    )}
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
