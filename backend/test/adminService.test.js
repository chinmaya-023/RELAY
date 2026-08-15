import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminService } from '../src/services/adminService.js';

const makeUser = (overrides = {}) => ({
  uid: 'user_1',
  email: 'user@example.com',
  displayName: 'User',
  emailVerified: true,
  disabled: false,
  metadata: { creationTime: '2026-01-01T00:00:00.000Z', lastSignInTime: '2026-01-02T00:00:00.000Z' },
  ...overrides
});

test('suspending an account revokes its refresh tokens while restoring does not', async () => {
  const revoked = [];
  const auth = {
    async updateUser(uid, { disabled }) { return makeUser({ uid, disabled }); },
    async revokeRefreshTokens(uid) { revoked.push(uid); }
  };
  const service = new AdminService({}, { auth: () => auth });

  const suspended = await service.setUserDisabled('user_1', true);
  assert.equal(suspended.disabled, true);
  assert.deepEqual(revoked, ['user_1']);
  await service.setUserDisabled('user_1', false);
  assert.deepEqual(revoked, ['user_1']);
});

test('direct account deletion requires the selected account email and rejects self-deletion', async () => {
  const deletions = [];
  const auth = { async getUser() { return makeUser({ email: 'Target@Example.com' }); } };
  const service = new AdminService({}, {
    auth: () => auth,
    accountDeletionService: { async deleteDirectly(uid, reviewer) { deletions.push({ uid, reviewer }); return { status: 'DELETED' }; } }
  });
  const reviewer = { uid: 'admin_1', email: 'admin@example.com' };

  await assert.rejects(service.deleteUser('user_1', reviewer, 'wrong@example.com'), { code: 'ACCOUNT_DELETION_EMAIL_MISMATCH' });
  assert.deepEqual(await service.deleteUser('user_1', reviewer, 'target@example.com'), { status: 'DELETED' });
  assert.deepEqual(deletions, [{ uid: 'user_1', reviewer }]);
  await assert.rejects(service.deleteUser('admin_1', reviewer, 'admin@example.com'), { code: 'RELAY_ADMIN_SELF_DELETION_DENIED' });
});

test('direct account deletion reports an already removed account without leaking provider errors', async () => {
  const service = new AdminService({}, {
    auth: () => ({ async getUser() { const error = new Error('missing'); error.code = 'auth/user-not-found'; throw error; } }),
    accountDeletionService: { async deleteDirectly() { throw new Error('should not run'); } }
  });

  await assert.rejects(service.deleteUser('gone', { uid: 'admin_1', email: 'admin@example.com' }, 'gone@example.com'), { code: 'ACCOUNT_NOT_FOUND', status: 404 });
});
