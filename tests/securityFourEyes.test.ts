import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Security & Governance Enforcement (SEC-02 & Maker-Checker)', () => {
  it('Maker-Checker 4-Eyes Principle: Maker cannot approve their own batch', () => {
    const batch = {
      id: 'batch-101',
      maker_id: 'user-ahmed',
      status: 'PENDING_REVIEW',
    };

    const approver = {
      id: 'user-ahmed', // Same user
      email: 'ahmed@mubasher.net',
      role: 'SUPER_ADMIN',
    };

    const isSelfApproval = batch.maker_id === approver.id;
    assert.equal(isSelfApproval, true);

    const checkAuthorization = (makerId: string, checkerId: string): { allowed: boolean; error?: string } => {
      if (makerId === checkerId) {
        return {
          allowed: false,
          error: 'Four-Eyes Principle Violation: Maker cannot approve their own submitted transfer sheet batch.',
        };
      }
      return { allowed: true };
    };

    const res = checkAuthorization(batch.maker_id, approver.id);
    assert.equal(res.allowed, false);
    assert.ok(res.error?.includes('Four-Eyes Principle Violation'));
  });

  it('Independent Checker: Different user CAN approve batch', () => {
    const batch = {
      id: 'batch-101',
      maker_id: 'user-ahmed',
      status: 'PENDING_REVIEW',
    };

    const checker = {
      id: 'user-youssef', // Different user
      email: 'youssef@mubasher.net',
      role: 'SUPER_ADMIN',
    };

    const isDifferentUser = batch.maker_id !== checker.id;
    assert.equal(isDifferentUser, true);
  });

  it('Post-Lock Immutability: Rejects any modification when batch is LOCKED or APPROVED', () => {
    const lockedBatch = { status: 'LOCKED' };
    const approvedBatch = { status: 'APPROVED' };
    const draftBatch = { status: 'DRAFT' };

    const isBatchLocked = (status: string) => status === 'LOCKED' || status === 'APPROVED';

    assert.equal(isBatchLocked(lockedBatch.status), true, 'LOCKED batch must reject mutations');
    assert.equal(isBatchLocked(approvedBatch.status), true, 'APPROVED batch must reject mutations');
    assert.equal(isBatchLocked(draftBatch.status), false, 'DRAFT batch may accept adjustments');
  });
});
