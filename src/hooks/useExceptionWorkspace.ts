// Exception Workspace Domain Hook
// Manages operational exception queue, individual/bulk resolution & purged state persistence

'use client';

import { useState } from 'react';
import { ExceptionRecord } from '@/lib/types';
import {
  cleanResolvedExceptionsAction,
  fetchWorkspaceDataAction,
  resolveAllExceptionsAction,
  resolveExceptionAction,
} from '@/app/actions/workspaceActions';
import { formatUserFriendlyError } from '@/lib/error-formatter';

export interface UseExceptionWorkspaceProps {
  onAuditLog: (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => void;
  onError: (error: string | null) => void;
  onRefreshAuditLogs?: () => Promise<void>;
}

export function useExceptionWorkspace({
  onAuditLog,
  onError,
  onRefreshAuditLogs,
}: UseExceptionWorkspaceProps) {
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);

  const handleResolveException = async (id: string) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex))
    );
    onAuditLog('RESOLVE_EXCEPTION', 'EXCEPTION_RECORD', id);
    await resolveExceptionAction(id);
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.exceptions) {
      setExceptions(wsData.exceptions);
    }
  };

  const handleResolveAllExceptions = async () => {
    setExceptions((prev) =>
      prev.map((ex) => ({ ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() }))
    );
    onAuditLog('RESOLVE_ALL_EXCEPTIONS', 'EXCEPTION_RECORD', 'ALL');
    await resolveAllExceptionsAction();
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.exceptions) {
      setExceptions(wsData.exceptions);
    }
  };

  const handleCleanResolvedExceptions = async () => {
    try {
      // Optimistically clear resolved exceptions from UI
      setExceptions((prev) => prev.filter((e) => e.status !== 'RESOLVED'));
      const res = await cleanResolvedExceptionsAction();
      if (!res.success) {
        onError(formatUserFriendlyError(res.error || 'Failed to clear resolved exceptions.'));
      }
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.exceptions) {
        setExceptions(wsData.exceptions);
      }
      if (onRefreshAuditLogs) await onRefreshAuditLogs();
    } catch (err) {
      onError(formatUserFriendlyError(err));
    }
  };

  return {
    exceptions,
    setExceptions,
    handleResolveException,
    handleResolveAllExceptions,
    handleCleanResolvedExceptions,
  };
}
