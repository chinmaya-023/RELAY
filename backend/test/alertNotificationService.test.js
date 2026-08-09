import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertNotificationService } from '../src/services/alertNotificationService.js';

const createRepository = () => {
  const state = { notifications: [], updates: [] };
  return {
    state,
    get: async () => ({ ownerId: 'owner_1', name: 'Checkout' }),
    createNotification: async (_projectId, notification) => { const entry = { id: 'ntf_1', ...notification }; state.notifications.push(entry); return entry; },
    updateNotification: async (_projectId, _id, update) => { state.updates.push(update); return update; }
  };
};

test('a verified Firebase owner receives a queued Trigger Email document without storing their address in Relay data', async () => {
  const repository = createRepository();
  const queued = [];
  const service = new AlertNotificationService(repository, {
    getUser: async () => ({ email: 'owner@example.test', emailVerified: true }),
    isDeliveryConfigured: true,
    queueEmail: async (message) => { queued.push(message); return { id: 'firestore_1' }; }
  });

  const result = await service.notifyBackendDown({
    backend: { id: 'bkd_1', projectId: 'prj_1', name: 'Production API' },
    health: { consecutiveFailures: 3 },
    result: { attempts: 3 },
    eventId: 'evt_1'
  });

  assert.equal(result.status, 'QUEUED');
  assert.equal(queued.length, 1);
  assert.equal(queued[0].to, 'owner@example.test');
  assert.match(queued[0].message.subject, /Production API/);
  assert.equal('to' in repository.state.notifications[0], false);
  assert.equal(repository.state.updates[0].dispatchId, 'firestore_1');
});

test('Relay preserves the dashboard alert and does not queue email until the Firebase Trigger Email extension is enabled', async () => {
  const repository = createRepository();
  const service = new AlertNotificationService(repository, {
    getUser: async () => ({ email: 'owner@example.test', emailVerified: true }),
    isDeliveryConfigured: false,
    queueEmail: async () => { throw new Error('should not queue'); }
  });

  const result = await service.notifyBackendDown({ backend: { id: 'bkd_1', projectId: 'prj_1', name: 'Production API' }, health: { consecutiveFailures: 3 }, result: { attempts: 3 } });

  assert.equal(result.status, 'NOT_CONFIGURED');
});
