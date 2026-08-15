import { Router } from 'express';
import { projectIdSchema, failoverSchema, gatewaySchema } from '../schemas/index.js';
import { sendVersioned } from '../lib/etag.js';
import { ensureOwner } from './projects.js';
import { requireScope } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const gatewayResponse = (config) => ({ ...config, url: config.enabled && config.slug ? `/g/${config.slug}` : null });

export const createConfigurationRouter = ({ repository, resources, failoverService }) => {
  const router = Router();
  const access = async (request) => {
    const { id } = projectIdSchema.parse(request.params);
    const project = await resources.projectForUser(id, request.user.uid, request.user.projectId);
    return { id, project };
  };

  router.get('/projects/:id/gateway', requireScope('gateway:read'), async (request, response) => {
    const { id } = await access(request);
    const config = await resources.gatewayConfig(id);
    return sendVersioned(request, response, { type: 'gateway', id, version: config.version, data: gatewayResponse(config) });
  });

  router.patch('/projects/:id/gateway', requireScope('gateway:write'), async (request, response) => {
    const { id, project } = await access(request);
    ensureOwner(project);
    const input = gatewaySchema.parse(request.body);
    const existing = await repository.getGatewayConfig(id);
    if (input.enabled ?? existing?.enabled) {
      const backends = await repository.listBackends(id);
      if (!backends.length) throw new AppError(400, 'GATEWAY_BACKEND_REQUIRED', 'Register at least one backend before enabling the gateway.');
      if (!(input.slug ?? existing?.slug)) throw new AppError(400, 'GATEWAY_NAME_REQUIRED', 'Choose a gateway name before enabling the gateway.');
    }
    const config = await repository.updateGatewayConfig(id, input);
    resources.invalidateProject(id);
    return response.json({ success: true, data: gatewayResponse(config), meta: { version: config.version } });
  });

  router.get('/projects/:id/failover', requireScope('monitoring:read'), async (request, response) => {
    const { id } = await access(request);
    const [config, state] = await Promise.all([repository.getFailoverConfig(id), repository.getFailoverState(id)]);
    return sendVersioned(request, response, { type: 'failover', id, version: config.version, data: { config, state, warning: 'Backend failover does not synchronize application state. Verify that both backends use compatible shared state and configuration.' } });
  });

  router.patch('/projects/:id/failover', requireScope('monitoring:write'), async (request, response) => {
    const { id, project } = await access(request);
    ensureOwner(project);
    const input = failoverSchema.parse(request.body);
    if (input.enabled) {
      const [primary, secondary] = await Promise.all([repository.getBackend(input.primaryBackendId), repository.getBackend(input.secondaryBackendId)]);
      if (!primary || !secondary || primary.projectId !== id || secondary.projectId !== id || primary.id === secondary.id) {
        return response.status(400).json({ success: false, error: { code: 'INVALID_FAILOVER_BACKENDS', message: 'Choose two distinct backends from this project.' }, requestId: request.id });
      }
    }
    const config = await repository.updateFailoverConfig(id, input);
    await failoverService.reconcile(id);
    resources.invalidateProject(id);
    return response.json({ success: true, data: config, meta: { version: config.version } });
  });

  router.get('/projects/:id/events', requireScope('monitoring:read'), async (request, response) => {
    const { id } = await access(request);
    const events = await repository.listEvents(id);
    return response.json({ success: true, data: events });
  });

  return router;
};
