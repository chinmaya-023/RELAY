import { AppError } from '../lib/errors.js';
import { transitionHealth } from '../domain/healthState.js';
import { requestExternal } from './outboundRequest.js';

const healthUrl = (backend) => new URL(backend.healthPath, backend.originUrl).toString();
const cancellationError = () => new AppError(499, 'REQUEST_CANCELLED', 'The health test was cancelled.');
const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(cancellationError());
  const timeout = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
  const abort = () => { clearTimeout(timeout); reject(cancellationError()); };
  signal?.addEventListener('abort', abort, { once: true });
});

export class MonitoringService {
  #locks = new Set();

  constructor(repository, failoverService, options = {}) {
    this.repository = repository;
    this.failoverService = failoverService;
    this.request = options.request ?? requestExternal;
    this.wait = options.wait ?? wait;
    this.alertNotificationService = options.alertNotificationService ?? null;
  }

  async checkBackend(backendId, { keepAlive = false, signal } = {}) {
    if (this.#locks.has(backendId)) return { skipped: true, reason: 'CHECK_ALREADY_RUNNING' };
    if (signal?.aborted) throw cancellationError();
    this.#locks.add(backendId);
    try {
      const [backend, monitor, previous] = await Promise.all([this.repository.getBackend(backendId), this.repository.getMonitor(backendId), this.repository.getHealth(backendId)]);
      if (!backend) throw new AppError(404, 'BACKEND_NOT_FOUND', 'Backend not found.');
      if (!monitor) throw new AppError(404, 'MONITOR_NOT_FOUND', 'Monitoring configuration not found.');
      const result = await this.#checkWithRetries(backend, monitor, signal);
      const health = transitionHealth(previous, result, monitor);
      const history = { backendId, timestamp: health.updatedAt, keepAlive, ...result, status: health.status };
      await this.repository.saveHealth(backendId, health, history);
      if (previous?.status !== health.status) {
        const type = health.status === 'UNHEALTHY' ? 'BACKEND_DOWN' : health.status === 'HEALTHY' ? 'BACKEND_RECOVERED' : 'BACKEND_STATUS_CHANGED';
        const event = await this.repository.appendEvent(backend.projectId, { type, severity: health.status === 'UNHEALTHY' ? 'critical' : 'info', message: `${backend.name} is ${health.status.toLowerCase()}.`, backendId });
        if (type === 'BACKEND_DOWN') await this.alertNotificationService?.notifyBackendDown({ backend, health, result, eventId: event?.id });
      }
      await this.failoverService.reconcile(backend.projectId);
      return { health, result };
    } finally { this.#locks.delete(backendId); }
  }

  async #checkWithRetries(backend, monitor, signal) {
    const maxAttempts = monitor.maxAttempts ?? 3;
    const retryDelayMs = (monitor.retryDelaySeconds ?? 5) * 1000;
    let result;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await this.request({ url: healthUrl(backend), timeoutMs: monitor.timeoutSeconds * 1000, redirects: 2, maxResponseBytes: 262_144, signal });
        result = { success: response.status >= 200 && response.status < 400, httpStatus: response.status, latencyMs: Date.now() - startedAt, errorCode: response.status >= 400 ? 'UNHEALTHY_HTTP_STATUS' : null, attempts: attempt };
      } catch (error) {
        if (error?.code === 'REQUEST_CANCELLED') throw error;
        result = { success: false, httpStatus: null, latencyMs: Date.now() - startedAt, errorCode: error.code ?? 'HEALTH_CHECK_FAILED', attempts: attempt };
      }
      if (result.success || attempt === maxAttempts) return result;
      await this.wait(retryDelayMs, signal);
    }
    return result;
  }
}
