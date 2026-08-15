import { Router } from 'express';
import { requireInteractiveAuth } from '../middleware/auth.js';
import { accountDeletionRequestSchema } from '../schemas/index.js';

export const createAccountRouter = ({ accountDeletionService }) => {
  const router = Router();
  router.use(requireInteractiveAuth);

  router.get('/deletion/request', async (request, response) => response.json({ success: true, data: await accountDeletionService.status(request.user) }));

  router.post('/deletion/request', async (request, response) => {
    const input = accountDeletionRequestSchema.parse(request.body);
    const result = await accountDeletionService.request(request.user, input);
    return response.status(202).json({ success: true, data: result });
  });

  return router;
};
