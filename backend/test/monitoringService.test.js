import test from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringService } from '../src/services/monitoringService.js';

const backend = { id: 'bkd_1', projectId: 'prj_1', name: 'Production API', originUrl: 'https://api.example.test', healthPath: '/health' };
const monitor = { backendId: backend.id, timeoutSeconds: 2, maxAttempts: 3, retryDelaySeconds: 4, failureThreshold: 1, recoveryThreshold: 1 };

const createRepository = ({ previous = { status: 'HEALTHY', consecutiveFailures: 0, consecutiveSuccesses: 1, version: 1 } } = {}) => {
  const state = { saved: [], events: [] };
  return {
    state,
    getBackend: async () => backend,
    getMonitor: async () => monitor,
    getHealth: async () => previous,
    saveHealth: async (_backendId, health, history) => { state.saved.push({ health, history }); },
    appendEvent: async (_projectId, event) => { const entry = { id: 'evt_1', ...event }; state.events.push(entry); return entry; }
  };
};

test('a health check retries failed probes and treats a later successful response as healthy', async () => {
  const repository = createRepository();
  const retryDelays = [];
  let attempts = 0;
  const service = new MonitoringService(repository, { reconcile: async () => {} }, {
    request: async () => {
      attempts += 1;
      if (attempts < 3) return { status: 503 };
      return { status: 204 };
    },
    wait: async (milliseconds) => { retryDelays.push(milliseconds); }
  });

  const { result, health } = await service.checkBackend(backend.id);

  assert.equal(result.success, true);
  assert.equal(result.attempts, 3);
  assert.equal(health.status, 'HEALTHY');
  assert.deepEqual(retryDelays, [4000, 4000]);
  assert.equal(repository.state.saved[0].history.attempts, 3);
});

test('an outage alert is created only after every configured retry is exhausted and the status becomes unhealthy', async () => {
  const repository = createRepository();
  const alertCalls = [];
  const service = new MonitoringService(repository, { reconcile: async () => {} }, {
    request: async () => ({ status: 503 }),
    wait: async () => {},
    alertNotificationService: { notifyBackendDown: async (input) => { alertCalls.push(input); } }
  });

  const { result, health } = await service.checkBackend(backend.id);

  assert.equal(result.success, false);
  assert.equal(result.attempts, 3);
  assert.equal(health.status, 'UNHEALTHY');
  assert.equal(repository.state.events[0].type, 'BACKEND_DOWN');
  assert.equal(alertCalls.length, 1);
  assert.equal(alertCalls[0].result.attempts, 3);
});
