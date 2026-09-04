'use client';

import React from 'react';
import { ShieldAlert, UserX, X } from 'lucide-react';

interface FourEyesAlertSnackbarProps {
  isOpen: boolean;
  onClose: () => void;
  makerName?: string;
  message?: string;
}

export function FourEyesAlertSnackbar({
  isOpen,
  onClose,
  makerName,
  message,
}: FourEyesAlertSnackbarProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border-2 border-amber-500/80 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
              Four-Eyes Principle
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Maker-Checker Policy</span>
          </div>

          <h4 className="text-sm font-bold text-slate-100 mt-1.5 flex items-center gap-1.5">
            <UserX className="w-4 h-4 text-rose-400 shrink-0" />
            Independent Checker Required
          </h4>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {message ||
              `You cannot approve this transfer sheet because you submitted it${
                makerName ? ` (${makerName})` : ''
              }. A different authorized user or checker must review and grant the official lock.`}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
            >
              Understood
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              Enforced at database & server layer
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
