import test from 'node:test';
import assert from 'node:assert/strict';
import { assertVerifiedEmail } from '../src/middleware/auth.js';
import { requireAllowedBrowserOrigin, requireJsonBody } from '../src/middleware/requestSecurity.js';

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
