import test from 'node:test';
import assert from 'node:assert/strict';

process.env.RELAY_API_KEY_PEPPER = 'test-pepper';
const { ApiKeyService } = await import('../src/services/apiKeyService.js');

test('API keys are returned only at creation and verified from their hash', async () => {
  let stored;
  const repository = {
    async createApiKey(_uid, value) { stored = value; },
    async getApiKeyByPrefix(prefix) { return prefix === stored.prefix ? stored : null; }
  };
  const service = new ApiKeyService(repository);
  const created = await service.create('user_1', { name: 'CI', scopes: ['project:read'] });
  assert.match(created.key, /^relay_/);
  assert.equal(created.record.secretHash, undefined);
  const verified = await service.verify(created.key);
  assert.deepEqual(verified, { uid: 'user_1', apiKeyId: stored.id, scopes: ['project:read'], projectId: null });
  await assert.rejects(service.verify(`${created.key}tampered`), { code: 'INVALID_API_KEY' });
});
