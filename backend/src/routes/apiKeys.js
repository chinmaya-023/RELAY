import { Router } from 'express';
import { requireInteractiveAuth } from '../middleware/auth.js';
import { apiKeyIdSchema, apiKeySchema } from '../schemas/index.js';
import { AppError } from '../lib/errors.js';

export const createApiKeyRouter = ({ repository, apiKeyService }) => {
  const router = Router();
  router.use(requireInteractiveAuth);
  router.get('/', async (request, response) => response.json({ success: true, data: await repository.listApiKeys(request.user.uid) }));
  router.post('/', async (request, response) => {
    const input = apiKeySchema.parse(request.body);
    if (input.expiresAt && input.expiresAt <= Date.now()) throw new AppError(400, 'INVALID_API_KEY_EXPIRY', 'API key expiry must be in the future.');
    if (input.projectId) await repository.projectForUser(input.projectId, request.user.uid);
    const result = await apiKeyService.create(request.user.uid, input);
    return response.status(201).json({ success: true, data: result, meta: { shownOnce: true } });
  });
  router.delete('/:id', async (request, response) => {
    const { id } = apiKeyIdSchema.parse(request.params);
    await repository.revokeApiKey(id, request.user.uid);
    return response.status(204).end();
  });
  return router;
};
