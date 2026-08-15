import { Router } from 'express';
import { AppError } from '../lib/errors.js';
import { sendVersioned } from '../lib/etag.js';
import { resolvePublicDestination } from '../security/ssrf.js';
import { backendIdSchema, createBackendSchema, projectIdSchema, updateBackendSchema } from '../schemas/index.js';
import { ensureOwner } from './projects.js';
import { requireScope } from '../middleware/auth.js';

const verifyBackendAccess = async (repository, resources, backendId, user) => {
  const backend = await repository.getBackend(backendId);
  if (!backend) throw new AppError(404, 'BACKEND_NOT_FOUND', 'Backend not found.');
  const project = await resources.projectForUser(backend.projectId, user.uid, user.projectId);
  return { backend, project };
};

export const createBackendRouter = ({ repository, resources, monitoringService }) => {
  const router = Router();

  router.get('/projects/:id/backends', requireScope('project:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    const project = await resources.projectForUser(id, request.user.uid, request.user.projectId);
    const backends = await repository.listBackends(id);
    const withHealth = await Promise.all(backends.map(async (backend) => ({ ...backend, health: await repository.getHealth(backend.id) })));
    return response.json({ success: true, data: withHealth, meta: { version: project.version } });
  });

  router.post('/projects/:id/backends', requireScope('project:write'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    ensureOwner(await resources.projectForUser(id, request.user.uid, request.user.projectId));
    const input = createBackendSchema.parse(request.body);
    await resolvePublicDestination(input.originUrl);
    const backend = await repository.addBackend(id, input);
    resources.invalidateBackend(id);
    return response.status(201).json({ success: true, data: backend, meta: { version: backend.version } });
  });

  router.get('/backends/:id', requireScope('project:read'), async (request, response) => {
    const { id } = backendIdSchema.parse(request.params);
    const { backend } = await verifyBackendAccess(repository, resources, id, request.user);
    return sendVersioned(request, response, { type: 'backend', id, version: backend.version, data: backend });
  });

  router.patch('/backends/:id', requireScope('project:write'), async (request, response) => {
    const { id } = backendIdSchema.parse(request.params);
    const { backend, project } = await verifyBackendAccess(repository, resources, id, request.user);
    ensureOwner(project);
    const input = updateBackendSchema.parse(request.body);
    if (input.originUrl) await resolvePublicDestination(input.originUrl);
    const next = await repository.updateBackend(backend.id, input);
    resources.invalidateBackend(backend.projectId);
    return response.json({ success: true, data: next, meta: { version: next.version } });
  });

  router.delete('/backends/:id', requireScope('project:write'), async (request, response) => {
    const { id } = backendIdSchema.parse(request.params);
    const { backend, project } = await verifyBackendAccess(repository, resources, id, request.user);
    ensureOwner(project);
    await repository.deleteBackend(backend.id);
    resources.invalidateBackend(backend.projectId);
    return response.status(204).end();
  });

  router.post('/backends/:id/test', requireScope('monitoring:write'), async (request, response) => {
    const { id } = backendIdSchema.parse(request.params);
    await verifyBackendAccess(repository, resources, id, request.user);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.on('aborted', abort);
    response.on('close', () => { if (!response.writableEnded) abort(); });
    try {
      const result = await monitoringService.checkBackend(id, { signal: controller.signal });
      if (!controller.signal.aborted) return response.json({ success: true, data: result });
      return undefined;
    } finally {
      request.off('aborted', abort);
    }
  });

  return router;
};
