import test from 'node:test';
import assert from 'node:assert/strict';
import { assertVerifiedEmail } from '../src/middleware/auth.js';
import { forwardedRequestHeaders } from '../src/gateway/gatewayHandler.js';
import { requestId } from '../src/lib/requestId.js';
import { rejectOversizedRequestMetadata, requireAllowedBrowserOrigin, requireJsonBody } from '../src/middleware/requestSecurity.js';

const runMiddleware = (middleware, request) => new Promise((resolve) => middleware(request, {}, (error) => resolve(error)));

test('email verification is required for Firebase-authenticated API access', () => {
  assert.throws(() => assertVerifiedEmail({ email_verified: false }), { code: 'EMAIL_VERIFICATION_REQUIRED' });
  assert.doesNotThrow(() => assertVerifiedEmail({ email_verified: true }));
});

test('state-changing API requests require JSON when they include a body', async () => {
  const error = await runMiddleware(requireJsonBody, { method: 'POST', get: (header) => ({ 'content-length': '4', 'transfer-encoding': undefined }[header]), is: () => false });
  assert.equal(error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('state-changing browser requests reject unknown origins', async () => {
  const middleware = requireAllowedBrowserOrigin(['https://app.example.com']);
  const error = await runMiddleware(middleware, { method: 'DELETE', get: (header) => header === 'origin' ? 'https://untrusted.example' : undefined });
  assert.equal(error.code, 'ORIGIN_NOT_ALLOWED');
});

test('request metadata limits reject oversized URLs and headers before application work', async () => {
  const longUrl = await runMiddleware(rejectOversizedRequestMetadata, { originalUrl: `/${'x'.repeat(8 * 1024)}`, headers: {} });
  assert.equal(longUrl.code, 'REQUEST_URL_TOO_LARGE');
  const largeHeaders = await runMiddleware(rejectOversizedRequestMetadata, { originalUrl: '/', headers: { 'x-test': 'x'.repeat(16 * 1024) } });
  assert.equal(largeHeaders.code, 'REQUEST_HEADERS_TOO_LARGE');
});

test('Relay always creates its own request ID instead of accepting a caller-controlled value', () => {
  const response = { headers: {}, set(name, value) { this.headers[name] = value; } };
  const request = { get: () => 'caller-controlled-request-id' };
  requestId(request, response, () => undefined);
  assert.match(request.id, /^relay_[0-9a-f-]{36}$/);
  assert.equal(response.headers['X-Request-ID'], request.id);
  assert.notEqual(request.id, 'caller-controlled-request-id');
  const internalRequest = { id: request.id, get: () => undefined };
  requestId(internalRequest, response, () => undefined);
  assert.equal(internalRequest.id, request.id);
});

test('gateway forwarding strips spoofable proxy and Relay-control headers', () => {
  const headers = forwardedRequestHeaders({ authorization: 'Bearer app-token', 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '203.0.113.5', 'x-relay-project-id': 'other-project', 'x-request-id': 'spoofed', host: 'gateway.example', connection: 'keep-alive' });
  assert.deepEqual(headers, { authorization: 'Bearer app-token' });
});
