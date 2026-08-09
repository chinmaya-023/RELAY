import { Router } from 'express';
import { projectIdSchema } from '../schemas/index.js';
import { providerAdapterFor } from '../providers/providerAdapter.js';
import { requireScope } from '../middleware/auth.js';

export const createUsageRouter = ({ repository, resources }) => {
  const router = Router();
  router.get('/projects/:id/usage', requireScope('usage:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    const backends = await repository.listBackends(id);
    const reports = await Promise.all(backends.map(async (backend) => {
      const completeBackend = await repository.getBackend(backend.id);
      const adapter = providerAdapterFor(completeBackend.provider);
      return { backendId: backend.id, provider: completeBackend.provider, usage: await adapter.getUsage(), limits: await adapter.getLimits() };
    }));
    return response.json({ success: true, data: reports, meta: { stale: false } });
  });

  router.get('/projects/:id/alerts', requireScope('monitoring:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    const events = await repository.listEvents(id);
    const alerts = events.filter((event) => ['BACKEND_DOWN', 'FAILOVER_ACTIVATED'].includes(event.type));
    return response.json({ success: true, data: alerts });
  });

  router.get('/projects/:id/logs', requireScope('monitoring:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    return response.json({ success: true, data: await repository.listEvents(id) });
  });
  return router;
};
