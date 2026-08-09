import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const hash = (value) => createHash('sha256').update(`${env.apiKeyPepper}:${value}`).digest('hex');

export class ApiKeyService {
  constructor(repository) { this.repository = repository; }

  async create(uid, input) {
    if (!env.apiKeyPepper) throw new AppError(503, 'API_KEY_PEPPER_REQUIRED', 'RELAY_API_KEY_PEPPER must be configured before API keys can be created.');
    const secret = `relay_${randomBytes(32).toString('base64url')}`;
    const prefix = secret.slice(0, 18);
    const timestamp = Date.now();
    const apiKey = { id: `key_${randomUUID()}`, userId: uid, name: input.name, prefix, secretHash: hash(secret), scopes: input.scopes, projectId: input.projectId ?? null, createdAt: timestamp, expiresAt: input.expiresAt ?? null, revokedAt: null };
    await this.repository.createApiKey(uid, apiKey);
    return { key: secret, record: { ...apiKey, secretHash: undefined } };
  }

  async verify(secret) {
    if (!env.apiKeyPepper || !secret?.startsWith('relay_')) throw new AppError(401, 'INVALID_API_KEY', 'The API key is invalid.');
    const prefix = secret.slice(0, 18);
    const key = await this.repository.getApiKeyByPrefix(prefix);
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= Date.now())) throw new AppError(401, 'INVALID_API_KEY', 'The API key is invalid, expired, or revoked.');
    const expected = Buffer.from(key.secretHash, 'hex');
    const actual = Buffer.from(hash(secret), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new AppError(401, 'INVALID_API_KEY', 'The API key is invalid.');
    return { uid: key.userId, apiKeyId: key.id, scopes: key.scopes, projectId: key.projectId ?? null };
  }
}
