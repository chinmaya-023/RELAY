import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountDeletionService } from '../src/services/accountDeletionService.js';

const createRepository = () => {
  let request = null;
  let cleaned = false;
  return {
    async getAccountDeletionRequest() { return request; },
    async createAccountDeletionRequest(_uid, next) {
      if (['PENDING', 'PROCESSING'].includes(request?.status) || request?.cooldownUntil > next.requestedAt) return { created: false, request };
      request = next;
      return { created: true, request };
    },
    async claimAccountDeletionRequest(_uid, reviewerUid, timestamp) {
      if (request?.status !== 'PENDING') return { claimed: false, request };
      request = { ...request, status: 'PROCESSING', reviewedBy: reviewerUid, reviewedAt: timestamp };
      return { claimed: true, request };
    },
    async rejectAccountDeletionRequest(_uid, reviewerUid, timestamp) {
      if (request?.status !== 'PENDING') return { reviewed: false, request };
      request = { ...request, status: 'REJECTED', reviewedBy: reviewerUid, reviewedAt: timestamp };
      return { reviewed: true, request };
    },
    async releaseAccountDeletionRequest() { if (request?.status === 'PROCESSING') request = { ...request, status: 'PENDING', reviewedBy: null, reviewedAt: null }; },
    async clearAccountDeletionRequest() { request = null; },
    async deleteAccountData() { cleaned = true; },
    get request() { return request; },
    get cleaned() { return cleaned; }
  };
};

const user = (clock, overrides = {}) => ({ uid: 'user_1', email: 'owner@example.com', auth_time: Math.floor(clock / 1000), ...overrides });

test('a signed-in user creates one pending account-deletion request without email delivery', async () => {
  const clock = 1_800_000_000_000;
  const repository = createRepository();
  const service = new AccountDeletionService(repository, { now: () => clock, isRelayOwner: () => false });

  await assert.rejects(service.request(user(clock), { email: 'other@example.com' }), { code: 'ACCOUNT_DELETION_EMAIL_MISMATCH' });
  assert.deepEqual(await service.request(user(clock, { name: 'Owner' }), { email: 'OWNER@example.com' }), { status: 'PENDING', requestedAt: clock, reviewedAt: null });
  assert.equal(repository.request.status, 'PENDING');
  assert.equal(repository.request.email, 'owner@example.com');
  assert.deepEqual(await service.request(user(clock), { email: 'owner@example.com' }), { status: 'PENDING', requestedAt: clock, reviewedAt: null, alreadyRequested: true });
});

test('account deletion requires a recent sign-in and protects Relay owner accounts', async () => {
  const clock = 1_800_000_000_000;
  const repository = createRepository();
  const service = new AccountDeletionService(repository, { now: () => clock, isRelayOwner: (email) => email === 'owner@example.com' });

  await assert.rejects(service.request(user(clock - 16 * 60 * 1000), { email: 'owner@example.com' }), { code: 'ACCOUNT_DELETION_REAUTH_REQUIRED' });
  await assert.rejects(service.request(user(clock), { email: 'owner@example.com' }), { code: 'RELAY_OWNER_DELETION_DENIED' });
  assert.equal(repository.request, null);
});

test('a Relay owner can reject or approve a pending deletion, but never their own', async () => {
  let clock = 1_800_000_000_000;
  const repository = createRepository();
  let identityDeleted = false;
  const service = new AccountDeletionService(repository, { now: () => clock, isRelayOwner: () => false, deleteIdentity: async () => { identityDeleted = true; } });
  const requester = user(clock);
  const reviewer = { uid: 'admin_1', email: 'admin@example.com' };

  await service.request(requester, { email: requester.email });
  assert.deepEqual(await service.review(requester.uid, reviewer, 'reject'), { status: 'REJECTED' });
  assert.equal(repository.request.status, 'REJECTED');
  assert.deepEqual(await service.status(requester), { status: 'REJECTED', requestedAt: clock, reviewedAt: clock });

  clock += 60 * 60 * 1000;
  await service.request(user(clock), { email: requester.email });
  await assert.rejects(service.review(reviewer.uid, reviewer, 'approve'), { code: 'RELAY_ADMIN_SELF_DELETION_DENIED' });
  assert.deepEqual(await service.review(requester.uid, reviewer, 'approve'), { status: 'DELETED' });
  assert.equal(repository.cleaned, true);
  assert.equal(identityDeleted, true);
  assert.equal(repository.request, null);
});

test('a failed approval keeps the request pending so a Relay owner can retry safely', async () => {
  const clock = 1_800_000_000_000;
  const repository = createRepository();
  repository.deleteAccountData = async () => { throw new Error('database unavailable'); };
  const service = new AccountDeletionService(repository, { now: () => clock, isRelayOwner: () => false, deleteIdentity: async () => undefined });

  await service.request(user(clock), { email: 'owner@example.com' });
  await assert.rejects(service.review('user_1', { uid: 'admin_1', email: 'admin@example.com' }, 'approve'), { code: 'ACCOUNT_DELETION_RETRY_REQUIRED' });
  assert.equal(repository.request.status, 'PENDING');
});
