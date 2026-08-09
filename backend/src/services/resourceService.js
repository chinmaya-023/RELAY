import { MemoryCache } from '../lib/cache.js';
import { AppError } from '../lib/errors.js';

export class ResourceService {
  constructor(repository, cache = new MemoryCache()) { this.repository = repository; this.cache = cache; }

  async projectForUser(projectId, uid, scopedProjectId) {
    if (scopedProjectId && scopedProjectId !== projectId) throw new AppError(403, 'API_KEY_PROJECT_DENIED', 'This API key is restricted to a different project.');
    const key = `project:${projectId}:${uid}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    return this.cache.set(key, await this.repository.projectForUser(projectId, uid));
  }

  async gatewayConfig(projectId) {
    const key = `gateway:${projectId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    return this.cache.set(key, await this.repository.getGatewayConfig(projectId), 10_000);
  }

  async routingConfig(projectId) {
    const key = `routing:${projectId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const [gateway, failover, state] = await Promise.all([this.repository.getGatewayConfig(projectId), this.repository.getFailoverConfig(projectId), this.repository.getFailoverState(projectId)]);
    return this.cache.set(key, { gateway, failover, state }, 5_000);
  }

  invalidateProject(projectId, uid) {
    this.cache.deletePrefix(`project:${projectId}:`);
    this.cache.deletePrefix(`gateway:${projectId}`);
    this.cache.deletePrefix(`routing:${projectId}`);
    if (uid) this.cache.deletePrefix(`projects:${uid}`);
  }

  invalidateBackend(projectId) { this.invalidateProject(projectId); }
}
