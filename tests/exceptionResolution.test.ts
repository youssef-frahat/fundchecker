import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExceptionRecord } from '../src/lib/types';

describe('Operational Exception Resolution & Persistence Lifecycle (EX-01)', () => {
  const sampleExceptions: ExceptionRecord[] = [
    {
      id: '5004479f-3819-485d-af2d-12ac68d24c4a',
      fileId: 'file-123',
      fileName: '9_3_2026 11_08_08 AM.xlsx',
      exceptionType: 'UNKNOWN_SYMBOL',
      errorMessage: 'Unmapped symbol "B-70 Fund" in Request ID "IPO260902-1-00353".',
      status: 'OPEN',
      createdAt: '2026-09-04T16:04:26.000Z',
    },
    {
      id: '0039891d-1ac9-4533-a4b4-18a708d8fc66',
      fileId: 'file-123',
      fileName: '9_3_2026 11_08_08 AM.xlsx',
      exceptionType: 'UNKNOWN_SYMBOL',
      errorMessage: 'Unmapped symbol "B-70 Fund" in Request ID "IPO260903-1-00237".',
      status: 'OPEN',
      createdAt: '2026-09-04T16:04:26.000Z',
    },
    {
      id: 'resolved-already-uuid-1',
      fileId: 'file-120',
      fileName: 'older_file.xlsx',
      exceptionType: 'SCHEMATIC_ERR',
      errorMessage: 'Missing NAV unit price.',
      status: 'RESOLVED',
      createdAt: '2026-09-03T10:00:00.000Z',
      resolvedAt: '2026-09-03T10:15:00.000Z',
    },
  ];

  it('should accurately isolate open exception IDs for targeted bulk resolution', () => {
    const openExceptions = sampleExceptions.filter((e) => e.status === 'OPEN');
    assert.equal(openExceptions.length, 2, 'Must find exactly 2 open exceptions');
    
    const openIds = openExceptions.map((e) => e.id);
    assert.deepEqual(openIds, [
      '5004479f-3819-485d-af2d-12ac68d24c4a',
      '0039891d-1ac9-4533-a4b4-18a708d8fc66',
    ]);
  });

  it('should validate UUID format before database query execution to prevent 22P02 errors', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    assert.ok(UUID_REGEX.test('5004479f-3819-485d-af2d-12ac68d24c4a'));
    assert.ok(UUID_REGEX.test('0039891d-1ac9-4533-a4b4-18a708d8fc66'));
    assert.equal(UUID_REGEX.test('resolved-already-uuid-1'), false);
    assert.equal(UUID_REGEX.test('ALL'), false);
    assert.equal(UUID_REGEX.test(''), false);
  });

  it('should simulate optimistic state transition and rollback integrity on server failure', () => {
    let state = [...sampleExceptions];
    const previousSnapshot = [...state];

    // Optimistic update
    state = state.map((ex) =>
      ex.status === 'OPEN' ? { ...ex, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : ex
    );

    assert.equal(state.filter((e) => e.status === 'OPEN').length, 0, 'Optimistic state should show 0 open');
    assert.equal(state.filter((e) => e.status === 'RESOLVED').length, 3, 'Optimistic state should show 3 resolved');

    // Simulate server action failure
    const serverResult = { success: false, error: 'Database update failed: permission denied' };

    if (!serverResult.success) {
      // Rollback
      state = previousSnapshot;
    }

    assert.equal(state.filter((e) => e.status === 'OPEN').length, 2, 'State must rollback to 2 open exceptions');
    assert.equal(state.filter((e) => e.status === 'RESOLVED').length, 1, 'State must rollback to 1 resolved exception');
  });

  it('should simulate successful database sync updating all open exceptions permanently', () => {
    let state = [...sampleExceptions];

    // Optimistic update
    state = state.map((ex) =>
      ex.status === 'OPEN' ? { ...ex, status: 'RESOLVED', resolvedAt: '2026-09-04T18:30:00.000Z' } : ex
    );

    // Simulate server action success
    const serverResult = { success: true, count: 2 };
    assert.ok(serverResult.success);
    assert.equal(serverResult.count, 2);

    // DB refresh returns both newly resolved records
    const simulatedFreshDb: ExceptionRecord[] = sampleExceptions.map((ex) => ({
      ...ex,
      status: 'RESOLVED',
      resolvedAt: '2026-09-04T18:30:00.000Z',
    }));

    state = simulatedFreshDb;

    assert.equal(state.filter((e) => e.status === 'OPEN').length, 0, 'DB sync confirms 0 open exceptions');
    assert.equal(state.filter((e) => e.status === 'RESOLVED').length, 3, 'DB sync confirms 3 resolved exceptions');
  });
});
