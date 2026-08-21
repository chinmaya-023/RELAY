import { AppError } from '../lib/errors.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_REQUEST_URL_BYTES = 8 * 1024;
const MAX_REQUEST_HEADER_BYTES = 16 * 1024;
const passwordField = /^(?:password|newpassword|passwordconfirmation|confirmpassword)$/i;

export const rejectOversizedRequestMetadata = (request, _response, next) => {
  const urlBytes = Buffer.byteLength(request.originalUrl ?? request.url ?? '', 'utf8');
  if (urlBytes > MAX_REQUEST_URL_BYTES) return next(new AppError(414, 'REQUEST_URL_TOO_LARGE', 'Request URL exceeds the supported limit.'));
  const headerBytes = Object.entries(request.headers).reduce((total, [name, value]) => total + Buffer.byteLength(name, 'utf8') + Buffer.byteLength(Array.isArray(value) ? value.join(',') : String(value ?? ''), 'utf8') + 4, 0);
  if (headerBytes > MAX_REQUEST_HEADER_BYTES) return next(new AppError(431, 'REQUEST_HEADERS_TOO_LARGE', 'Request headers exceed the supported limit.'));
  return next();
};

// Password changes belong exclusively to the managed identity provider. Relay's
// API must never accept, log, or accidentally persist password values.
export const rejectPasswordFields = (request, _response, next) => {
  if (!mutationMethods.has(request.method) || !request.body || Array.isArray(request.body)) return next();
  if (Object.keys(request.body).some((key) => passwordField.test(key))) {
    return next(new AppError(400, 'PASSWORD_FIELD_NOT_ALLOWED', 'Relay does not accept password fields. Use the account sign-in or password-reset flow.'));
  }
  return next();
};

export const requireJsonBody = (request, _response, next) => {
  if (!mutationMethods.has(request.method)) return next();
  const hasTransferEncoding = Boolean(request.get('transfer-encoding'));
  const contentLength = Number(request.get('content-length') ?? 0);
  if (!hasTransferEncoding && contentLength === 0) return next();
  if (!request.is('application/json')) return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'This endpoint accepts application/json request bodies only.'));
  return next();
};

export const requireAllowedBrowserOrigin = (origins) => (request, _response, next) => {
  if (!mutationMethods.has(request.method)) return next();
  const origin = request.get('origin');
  // Relay authenticates browser requests with Authorization, not cookies. This origin check is defence in depth for CSRF.
  if (origin && !origins.includes(origin.replace(/\/$/, ''))) return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This browser origin is not permitted to make changes.'));
  return next();
};

export const createRateLimitMiddleware = (limiter, config, keyFor) => (request, response, next) => {
  try {
    const limit = limiter.take(keyFor(request), config);
    response.set({ 'X-RateLimit-Remaining': String(limit.remaining), 'X-RateLimit-Reset': String(Math.floor(limit.resetAt / 1000)) });
    return next();
  } catch (error) { return next(error); }
};
