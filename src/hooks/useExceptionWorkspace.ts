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
    const previousExceptions = [...exceptions];
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex))
    );
    onAuditLog('RESOLVE_EXCEPTION', 'EXCEPTION_RECORD', id);

    try {
      const res = await resolveExceptionAction(id);
      if (!res.success) {
        // Rollback optimistic state on server failure
        setExceptions(previousExceptions);
        onError(formatUserFriendlyError(res.error || 'Failed to resolve exception in database.'));
        return;
      }

      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.exceptions) {
        setExceptions(wsData.exceptions);
      }
      if (onRefreshAuditLogs) await onRefreshAuditLogs();
    } catch (err) {
      setExceptions(previousExceptions);
      onError(formatUserFriendlyError(err));
    }
  };

  const handleResolveAllExceptions = async () => {
    const openExceptions = exceptions.filter((e) => e.status === 'OPEN');
    if (openExceptions.length === 0) return;
    const openIds = openExceptions.map((e) => e.id);
    const previousExceptions = [...exceptions];

    setExceptions((prev) =>
      prev.map((ex) => (ex.status === 'OPEN' ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex))
    );
    onAuditLog('RESOLVE_ALL_EXCEPTIONS', 'EXCEPTION_RECORD', 'ALL');

    try {
      const res = await resolveAllExceptionsAction(openIds);
      if (!res.success) {
        // Rollback optimistic state on server failure
        setExceptions(previousExceptions);
        onError(formatUserFriendlyError(res.error || 'Failed to resolve exceptions in database.'));
        return;
      }

      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.exceptions) {
        setExceptions(wsData.exceptions);
      }
      if (onRefreshAuditLogs) await onRefreshAuditLogs();
    } catch (err) {
      setExceptions(previousExceptions);
      onError(formatUserFriendlyError(err));
    }
  };

  const handleCleanResolvedExceptions = async () => {
    const previousExceptions = [...exceptions];
    try {
      // Optimistically clear resolved exceptions from UI
      setExceptions((prev) => prev.filter((e) => e.status !== 'RESOLVED'));
      const res = await cleanResolvedExceptionsAction();
      if (!res.success) {
        setExceptions(previousExceptions);
        onError(formatUserFriendlyError(res.error || 'Failed to clear resolved exceptions.'));
        return;
      }
      const wsData = await fetchWorkspaceDataAction();
      if (wsData.success && wsData.exceptions) {
        setExceptions(wsData.exceptions);
      }
      if (onRefreshAuditLogs) await onRefreshAuditLogs();
    } catch (err) {
      setExceptions(previousExceptions);
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
