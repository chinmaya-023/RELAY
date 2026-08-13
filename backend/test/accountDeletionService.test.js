import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountDeletionService } from '../src/services/accountDeletionService.js';

const createRepository = () => {
  let request = null;
  let cleaned = false;
  return {
    async getAccountDeletionRequest() { return request; },
    async saveAccountDeletionRequest(_uid, value) { request = value; },
    async createAccountDeletionRequest(_uid, value) {
      if (request?.cooldownUntil > value.createdAt) return { created: false, request };
      request = value;
      return { created: true, request };
    },
    async clearAccountDeletionRequest() { request = null; },
    async claimAccountDeletionRequest(_uid, timestamp) {
      if (!request || request.processing || request.expiresAt <= timestamp) return { claimed: false, request };
      request = { ...request, processing: true, processingAt: timestamp };
      return { claimed: true, request };
    },
    async verifyAndClaimAccountDeletionRequest(_uid, candidateHash, timestamp, maxAttempts) {
      if (!request || request.expiresAt <= timestamp) return { status: 'EXPIRED', request };
      if (request.processing) return { status: 'IN_PROGRESS', request };
      if (request.attempts >= maxAttempts || request.codeHash !== candidateHash) {
        const attempts = request.attempts + 1;
        request = attempts >= maxAttempts ? null : { ...request, attempts };
        return { status: 'INVALID', request };
      }
      request = { ...request, processing: true, processingAt: timestamp };
      return { status: 'VALID', request };
    },
    async releaseAccountDeletionRequest() { if (request) request = { ...request, processing: false, processingAt: null }; },
    async deleteAccountData() { cleaned = true; },
    get request() { return request; },
    get cleaned() { return cleaned; }
  };
};

test('account deletion requires the signed-in email, a recent sign-in, and a single-use verification code', async () => {
  let clock = 1_800_000_000_000;
  const repository = createRepository();
  const deliveries = [];
  let deletedIdentity = false;
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async (message) => deliveries.push(message),
    deleteIdentity: async () => { deletedIdentity = true; }
  });
  const user = { uid: 'user_1', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await assert.rejects(service.request(user, { email: 'other@example.com' }), { code: 'ACCOUNT_DELETION_EMAIL_MISMATCH' });
  const sent = await service.request(user, { email: 'OWNER@example.com' });
  assert.equal(sent.cooldownSeconds, 60);
  assert.equal(deliveries.length, 1);
  assert.match(deliveries[0].message.text, /483920/);
  await assert.rejects(service.request(user, { email: 'owner@example.com' }), { code: 'ACCOUNT_DELETION_CODE_COOLDOWN' });

  const result = await service.confirm(user, { email: 'owner@example.com', code: '483920' });
  assert.deepEqual(result, { deleted: true });
  assert.equal(repository.request, null);
  assert.equal(deletedIdentity, true);
  assert.equal(repository.cleaned, true);
  await assert.rejects(service.confirm(user, { email: 'owner@example.com', code: '483920' }), { code: 'ACCOUNT_DELETION_CODE_INVALID' });
});

test('account deletion expires codes and clears them after five invalid attempts', async () => {
  let clock = 1_800_000_000_000;
  const repository = createRepository();
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async () => undefined,
    deleteIdentity: async () => undefined
  });
  const user = { uid: 'user_2', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await service.request(user, { email: 'owner@example.com' });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(service.confirm(user, { email: 'owner@example.com', code: '000000' }), { code: 'ACCOUNT_DELETION_CODE_INVALID' });
  }
  assert.equal(repository.request, null);

  clock += 60_001;
  await service.request(user, { email: 'owner@example.com' });
  clock += 10 * 60 * 1000;
  await assert.rejects(service.confirm(user, { email: 'owner@example.com', code: '483920' }), { code: 'ACCOUNT_DELETION_CODE_INVALID' });
  assert.equal(repository.request.expiresAt, clock);
});

test('parallel invalid verification attempts are limited to five in total', async () => {
  const clock = 1_800_000_000_000;
  const repository = createRepository();
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async () => undefined,
    deleteIdentity: async () => undefined
  });
  const user = { uid: 'user_parallel', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await service.request(user, { email: 'owner@example.com' });
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.confirm(user, { email: 'owner@example.com', code: '000000' })));
  assert.equal(results.filter((result) => result.status === 'rejected').length, 20);
  assert.equal(repository.request, null);
});

test('account deletion does not report success when Relay data cleanup fails', async () => {
  let clock = 1_800_000_000_000;
  const repository = createRepository();
  repository.deleteAccountData = async () => { throw new Error('database unavailable'); };
  let deletedIdentity = false;
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async () => undefined,
    deleteIdentity: async () => { deletedIdentity = true; }
  });
  const user = { uid: 'user_3', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await service.request(user, { email: 'owner@example.com' });
  await assert.rejects(service.confirm(user, { email: 'owner@example.com', code: '483920' }), { code: 'ACCOUNT_DELETION_RETRY_REQUIRED' });
  assert.equal(deletedIdentity, false);
  assert.equal(repository.request.processing, false);
});

test('account deletion keeps the verified request so an identity-deletion failure can be retried safely', async () => {
  let clock = 1_800_000_000_000;
  const repository = createRepository();
  let deletionAttempts = 0;
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async () => undefined,
    deleteIdentity: async () => {
      deletionAttempts += 1;
      if (deletionAttempts === 1) throw new Error('identity service unavailable');
    }
  });
  const user = { uid: 'user_4', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await service.request(user, { email: 'owner@example.com' });
  await assert.rejects(service.confirm(user, { email: 'owner@example.com', code: '483920' }), { code: 'ACCOUNT_DELETION_RETRY_REQUIRED' });
  assert.equal(repository.request.processing, false);
  assert.deepEqual(await service.confirm(user, { email: 'owner@example.com', code: '483920' }), { deleted: true });
  assert.equal(repository.request, null);
});

test('account deletion clears the deletion record when the identity has already been removed', async () => {
  const clock = 1_800_000_000_000;
  const repository = createRepository();
  const service = new AccountDeletionService(repository, {
    now: () => clock,
    pepper: 'test-pepper',
    createCode: () => '483920',
    isDeliveryConfigured: true,
    queueEmail: async () => undefined,
    deleteIdentity: async () => {
      const error = new Error('already deleted');
      error.code = 'auth/user-not-found';
      throw error;
    }
  });
  const user = { uid: 'user_5', email: 'owner@example.com', auth_time: Math.floor(clock / 1000) };

  await service.request(user, { email: 'owner@example.com' });
  assert.deepEqual(await service.confirm(user, { email: 'owner@example.com', code: '483920' }), { deleted: true });
  assert.equal(repository.request, null);
});
