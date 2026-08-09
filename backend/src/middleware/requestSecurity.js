import { AppError } from '../lib/errors.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
