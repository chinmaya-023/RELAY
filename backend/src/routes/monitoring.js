import { Router } from 'express';
import { AppError } from '../lib/errors.js';
import { backendIdSchema, monitorSchema } from '../schemas/index.js';
import { ensureOwner } from './projects.js';
import { requireScope } from '../middleware/auth.js';

export const createMonitoringRouter = ({ repository, resources }) => {
  const router = Router();
  const access = async (request) => {
    const { id } = backendIdSchema.parse(request.params);
    const backend = await repository.getBackend(id);
    if (!backend) throw new AppError(404, 'BACKEND_NOT_FOUND', 'Backend not found.');
    const project = await resources.projectForUser(backend.projectId, request.user.uid, request.user.projectId);
    return { backend, project };
  };

  router.get('/backends/:id/monitor', requireScope('monitoring:read'), async (request, response) => {
    const { backend } = await access(request);
    const [monitor, health] = await Promise.all([repository.getMonitor(backend.id), repository.getHealth(backend.id)]);
    return response.json({ success: true, data: { monitor, health }, meta: { version: monitor.version } });
  });

  router.patch('/backends/:id/monitor', requireScope('monitoring:write'), async (request, response) => {
    const { backend, project } = await access(request);
    ensureOwner(project);
    const monitor = await repository.updateMonitor(backend.id, monitorSchema.parse(request.body));
    resources.invalidateBackend(backend.projectId);
    return response.json({ success: true, data: monitor, meta: { version: monitor.version } });
  });
  return router;
};
