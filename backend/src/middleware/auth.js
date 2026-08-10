import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export const assertVerifiedEmail = (user) => {
  if (user.email_verified !== true) throw new AppError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Please verify your email address before accessing Relay.');
};

export const createRequireAuth = (apiKeyService) => async (request, _response, next) => {
  try {
    const apiKey = request.get('x-relay-api-key');
    if (apiKey) {
      request.user = await apiKeyService.verify(apiKey);
      request.authType = 'api_key';
      return next();
    }
    if (env.allowLocalAuth && env.nodeEnv === 'development' && env.localUserId) {
      request.user = { uid: env.localUserId, local: true };
      request.authType = 'local';
      return next();
    }
    const token = request.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'A Firebase ID token is required.');
    request.user = await getAuth().verifyIdToken(token);
    assertVerifiedEmail(request.user);
    request.authType = 'firebase';
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(401, 'INVALID_TOKEN', 'The Firebase ID token could not be verified.'));
  }
};

export const requireScope = (scope) => (request, _response, next) => {
  if (request.authType !== 'api_key' || request.user.scopes?.includes(scope)) return next();
  return next(new AppError(403, 'API_KEY_SCOPE_DENIED', `This API key requires the ${scope} scope.`));
};

export const requireInteractiveAuth = (request, _response, next) => request.authType === 'firebase' || request.authType === 'local'
  ? next()
  : next(new AppError(403, 'INTERACTIVE_AUTH_REQUIRED', 'API key management requires Firebase Authentication.'));

export const requireRelayAdmin = (request, _response, next) => {
  if (request.authType !== 'firebase') return next(new AppError(403, 'RELAY_ADMIN_REQUIRED', 'A Relay owner account is required.'));
  if (!request.user.email || !env.adminEmails.includes(request.user.email.toLowerCase())) {
    return next(new AppError(403, 'RELAY_ADMIN_REQUIRED', 'This account does not have Relay owner access.'));
  }
  return next();
};
