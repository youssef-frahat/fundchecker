// Exception Center Component (White & Emerald Green Theme)

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ExceptionRecord } from '@/lib/types';

interface ExceptionCenterProps {
  exceptions: ExceptionRecord[];
  onResolveException: (id: string) => void;
}

export function ExceptionCenter({ exceptions, onResolveException }: ExceptionCenterProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Operational Exception Queue
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Isolates unmapped symbols, missing fund references, or file schematic anomalies. Zero auto-processing of unmapped data.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <span>Open Exceptions: </span>
          <span className="text-rose-700 font-bold">
            {exceptions.filter((e) => e.status === 'OPEN').length}
          </span>
        </div>
      </div>

      {/* Exception Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
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
          <tbody className="divide-y divide-slate-100">
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                  No operational exceptions recorded. System is processing cleanly.
                </td>
              </tr>
            ) : (
              exceptions.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-rose-700">{ex.id}</td>
                  <td className="p-3">
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {ex.exceptionType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800 font-sans">{ex.fileName}</td>
                  <td className="p-3 font-sans text-slate-800">{ex.errorMessage}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ex.status === 'RESOLVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {ex.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">
                    {new Date(ex.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })}
                  </td>
                  <td className="p-3 text-center">
                    {ex.status === 'OPEN' ? (
                      <button
                        onClick={() => onResolveException(ex.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-[11px] transition shadow-sm"
                      >
                        Resolve &amp; Re-parse
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-semibold text-[11px]">Resolved</span>
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
