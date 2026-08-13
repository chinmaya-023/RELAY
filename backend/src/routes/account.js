import { Router } from 'express';
import { requireInteractiveAuth } from '../middleware/auth.js';
import { accountDeletionConfirmSchema, accountDeletionRequestSchema } from '../schemas/index.js';

export const createAccountRouter = ({ accountDeletionService }) => {
  const router = Router();
  router.use(requireInteractiveAuth);

  router.post('/deletion/request', async (request, response) => {
    const input = accountDeletionRequestSchema.parse(request.body);
    const result = await accountDeletionService.request(request.user, input);
    return response.status(202).json({ success: true, data: result });
  });

  router.post('/deletion/confirm', async (request, response) => {
    const input = accountDeletionConfirmSchema.parse(request.body);
    const result = await accountDeletionService.confirm(request.user, input);
    return response.json({ success: true, data: result });
  });

  return router;
};
