import { AppError } from '../lib/errors.js';
import { HealthStatus } from '../domain/healthState.js';

export class FailoverService {
  constructor(repository) { this.repository = repository; }

  async reconcile(projectId) {
    const config = await this.repository.getFailoverConfig(projectId);
    const state = await this.repository.getFailoverState(projectId);
    if (!config?.enabled || !config.primaryBackendId || !config.secondaryBackendId) return state;
    const [primaryHealth, secondaryHealth] = await Promise.all([this.repository.getHealth(config.primaryBackendId), this.repository.getHealth(config.secondaryBackendId)]);
    const timestamp = Date.now();
    const current = state ?? { projectId, activeBackendId: config.primaryBackendId, mode: 'PRIMARY', changedAt: timestamp, version: 0 };
    let next = current;
    if (primaryHealth?.status === HealthStatus.UNHEALTHY && secondaryHealth?.status === HealthStatus.HEALTHY && current.activeBackendId !== config.secondaryBackendId) {
      next = { ...current, activeBackendId: config.secondaryBackendId, mode: 'FAILOVER', changedAt: timestamp, version: current.version + 1 };
      await this.repository.appendEvent(projectId, { type: 'FAILOVER_ACTIVATED', severity: 'critical', message: 'Traffic switched to the healthy secondary backend.', backendId: config.secondaryBackendId });
    } else if (current.activeBackendId === config.secondaryBackendId && config.recoveryMode === 'automatic' && primaryHealth?.status === HealthStatus.HEALTHY && timestamp - current.changedAt >= config.cooldownSeconds * 1000) {
      next = { ...current, activeBackendId: config.primaryBackendId, mode: 'PRIMARY', changedAt: timestamp, version: current.version + 1 };
      await this.repository.appendEvent(projectId, { type: 'FAILOVER_RECOVERED', severity: 'info', message: 'Traffic returned to the recovered primary backend.', backendId: config.primaryBackendId });
    }
    if (next !== current) await this.repository.saveFailoverState(projectId, next);
    return next;
  }

  async selectedBackend(projectId) {
    const config = await this.repository.getFailoverConfig(projectId);
    const state = await this.repository.getFailoverState(projectId);
    let backendId = config?.enabled ? state?.activeBackendId : config?.primaryBackendId;
    if (!backendId) {
      const backends = await this.repository.listBackends(projectId);
      backendId = backends.find((backend) => backend.role === 'PRIMARY')?.id ?? backends[0]?.id;
    }
    if (!backendId) throw new AppError(503, 'NO_BACKEND_CONFIGURED', 'No backend is configured for this project.');
    const backend = await this.repository.getBackend(backendId);
    if (!backend) throw new AppError(503, 'ROUTED_BACKEND_UNAVAILABLE', 'The selected backend no longer exists.');
    return backend;
  }
}
