// Checklist Workspace Domain Hook
// Manages daily operational checklists, supervisor approvals, shift resets & late task resolution

'use client';

import { useState } from 'react';
import { ChecklistItem, UserRole } from '@/lib/types';
import {
  approveChecklistAction,
  fetchWorkspaceDataAction,
  reopenChecklistAction,
  resetDailyChecklistsAction,
  resolveLateChecklistAction,
  updateChecklistStatusAction,
} from '@/app/actions/workspaceActions';

export interface UseChecklistWorkspaceProps {
  currentUser: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole;
  } | null;
  onAuditLog: (action: string, entityName: string, entityId?: string, newValues?: Record<string, unknown>) => void;
}

export function useChecklistWorkspace({
  currentUser,
  onAuditLog,
}: UseChecklistWorkspaceProps) {
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);

  const handleToggleChecklist = async (itemId: string, nextStatus: boolean = true) => {
    if (!currentUser) return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;
    const userId = currentUser.id;

    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId || c.checklistId === itemId
          ? nextStatus
            ? {
                ...c,
                isCompleted: true,
                completedBy: userEmail,
                completedByName: userName,
                completedAt: new Date().toISOString(),
              }
            : {
                ...c,
                isCompleted: false,
                completedBy: undefined,
                completedByName: undefined,
                completedAt: undefined,
              }
          : c
      )
    );

    await updateChecklistStatusAction(itemId, nextStatus, userEmail, userName, userId);
    onAuditLog(
      nextStatus ? 'CHECKLIST_COMPLETE' : 'CHECKLIST_UNDO',
      'CHECKLIST_ITEM',
      itemId,
      { status: nextStatus ? 'COMPLETED' : 'UNCHECKED' }
    );

    // Refresh checklists from database to guarantee cross-user parity
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.checklists) {
      setChecklists(wsData.checklists);
    }
  };

  const handleApproveChecklist = async (itemId: string) => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;
    const userId = currentUser.id;

    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId || c.checklistId === itemId
          ? {
              ...c,
              isApproved: true,
              approvedBy: userEmail,
              approvedByName: userName,
              approvedAt: new Date().toISOString(),
            }
          : c
      )
    );

    await approveChecklistAction(itemId, userEmail, userName, userId);
    onAuditLog('CHECKLIST_APPROVE', 'CHECKLIST_ITEM', itemId, {
      approvedBy: userName,
      note: 'Permanently locked by Super Admin',
    });

    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.checklists) {
      setChecklists(wsData.checklists);
    }
  };

  const handleReopenChecklist = async (itemId: string, reason: string) => {
    if (!currentUser) return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;
    const userId = currentUser.id;

    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId || c.checklistId === itemId
          ? {
              ...c,
              isCompleted: false,
              isApproved: false,
              reopenedBy: userEmail,
              reopenedByName: userName,
              reopenedAt: new Date().toISOString(),
              reopenReason: reason,
            }
          : c
      )
    );

    await reopenChecklistAction(itemId, userEmail, userName, reason, userId);
    onAuditLog('REOPEN_CHECKLIST', 'CHECKLIST_ITEM', itemId, { reason });

    // Refresh checklists from database to guarantee cross-user parity
    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.checklists) {
      setChecklists(wsData.checklists);
    }
  };

  const handleResolveLateChecklist = async (
    itemId: string,
    resolution: 'RESOLVED' | 'BREACHED',
    reason: string
  ) => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
    const userEmail = currentUser.email;
    const userName = currentUser.fullName;
    const userId = currentUser.id;

    setChecklists((prev) =>
      prev.map((c) =>
        c.id === itemId || c.checklistId === itemId
          ? resolution === 'RESOLVED'
            ? {
                ...c,
                isCompleted: true,
                isApproved: true,
                completedByName: `${userName} (Late Override)`,
                completedAt: new Date().toISOString(),
                approvedByName: userName,
                approvedAt: new Date().toISOString(),
                status: 'LATE_RESOLVED',
                reopenReason: reason,
              }
            : {
                ...c,
                isCompleted: false,
                status: 'BREACHED',
                reopenReason: reason,
              }
          : c
      )
    );

    await resolveLateChecklistAction(itemId, resolution, reason, userEmail, userName, userId);
    onAuditLog('LATE_CHECKLIST_RESOLUTION', 'CHECKLIST_ITEM', itemId, {
      resolution,
      reason,
      operator: userName,
    });

    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.checklists) {
      setChecklists(wsData.checklists);
    }
  };

  const handleResetDailyShift = async () => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;

    setChecklists((prev) =>
      prev.map((c) => ({
        ...c,
        isCompleted: false,
        isApproved: false,
        completedBy: undefined,
        completedByName: undefined,
        completedAt: undefined,
        approvedBy: undefined,
        approvedByName: undefined,
        approvedAt: undefined,
        reopenedBy: undefined,
        reopenedByName: undefined,
        reopenedAt: undefined,
        reopenReason: undefined,
        status: 'ACTIVE',
      }))
    );

    await resetDailyChecklistsAction();
    onAuditLog('DAILY_SHIFT_RESET', 'CHECKLISTS', 'ALL', {
      resetBy: currentUser.fullName,
      shiftStartCairo: new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo' }),
    });

    const wsData = await fetchWorkspaceDataAction();
    if (wsData.success && wsData.checklists) {
      setChecklists(wsData.checklists);
    }
  };

  return {
    checklists,
    setChecklists,
    handleToggleChecklist,
    handleApproveChecklist,
    handleReopenChecklist,
    handleResolveLateChecklist,
    handleResetDailyShift,
  };
}
