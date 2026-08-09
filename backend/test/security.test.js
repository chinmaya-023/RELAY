import test from 'node:test';
import assert from 'node:assert/strict';
import { isProhibitedAddress, parseOutboundUrl, resolvePublicDestination } from '../src/security/ssrf.js';
import { MemoryRateLimiter } from '../src/security/rateLimiter.js';

test('SSRF address policy denies loopback, private, link-local, and metadata ranges', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fe80::1', 'fc00::1']) assert.equal(isProhibitedAddress(address), true, address);
  assert.equal(isProhibitedAddress('8.8.8.8'), false);
});

test('SSRF URL policy rejects embedded credentials', () => {
  assert.throws(() => parseOutboundUrl('https://user:password@example.com'), { code: 'INVALID_ORIGIN_URL' });
});

test('SSRF resolver rejects direct private targets', async () => {
  await assert.rejects(resolvePublicDestination('http://127.0.0.1/'), { code: 'ORIGIN_PRIVATE_NETWORK_DENIED' });
});

test('in-memory limiter rejects only after its configured limit', () => {
  const limiter = new MemoryRateLimiter();
  limiter.take('project:ip', { windowSeconds: 60, maxRequests: 2 });
  limiter.take('project:ip', { windowSeconds: 60, maxRequests: 2 });
  assert.throws(() => limiter.take('project:ip', { windowSeconds: 60, maxRequests: 2 }), { code: 'RATE_LIMITED' });
});
