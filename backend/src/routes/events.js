import { Router } from 'express';
import { projectIdSchema } from '../schemas/index.js';
import { requireScope } from '../middleware/auth.js';

export const createEventRouter = ({ repository, resources }) => {
  const router = Router();
  router.get('/projects/:id/alerts', requireScope('monitoring:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    const events = await repository.listEvents(id);
    return response.json({ success: true, data: events.filter((event) => ['BACKEND_DOWN', 'FAILOVER_ACTIVATED'].includes(event.type)) });
  });
  router.get('/projects/:id/logs', requireScope('monitoring:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    return response.json({ success: true, data: await repository.listEvents(id) });
  });
  return router;
};
