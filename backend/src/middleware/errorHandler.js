import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler = (request, _response, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.path} was not found.`));

export const errorHandler = (error, request, response, _next) => {
  const normalized = error instanceof ZodError
    ? new AppError(400, 'VALIDATION_ERROR', 'One or more fields are invalid.', error.flatten())
    : error;
  const status = normalized instanceof AppError ? normalized.status : 500;
  const code = normalized instanceof AppError ? normalized.code : 'INTERNAL_ERROR';
  const message = normalized instanceof AppError ? normalized.message : 'An unexpected error occurred.';
  if (status >= 500) logger.error('request_failed', { requestId: request.id, code, message: normalized.message });
  if (normalized.details?.retryAfter) response.set('Retry-After', String(normalized.details.retryAfter));
  return response.status(status).json({ success: false, error: { code, message, ...(normalized.details ? { details: normalized.details } : {}) }, requestId: request.id });
};
