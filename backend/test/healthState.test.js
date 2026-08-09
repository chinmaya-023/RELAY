import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthStatus, transitionHealth } from '../src/domain/healthState.js';

const monitor = { failureThreshold: 3, recoveryThreshold: 2 };

test('health moves through degraded and unhealthy only after the configured failure threshold', () => {
  let state = { status: HealthStatus.HEALTHY, consecutiveFailures: 0, consecutiveSuccesses: 2, version: 1 };
  state = transitionHealth(state, { success: false, latencyMs: 4, errorCode: 'TIMEOUT' }, monitor);
  assert.equal(state.status, HealthStatus.DEGRADED);
  state = transitionHealth(state, { success: false, latencyMs: 4, errorCode: 'TIMEOUT' }, monitor);
  assert.equal(state.status, HealthStatus.DEGRADED);
  state = transitionHealth(state, { success: false, latencyMs: 4, errorCode: 'TIMEOUT' }, monitor);
  assert.equal(state.status, HealthStatus.UNHEALTHY);
});

test('health recovery respects the recovery threshold', () => {
  let state = { status: HealthStatus.UNHEALTHY, consecutiveFailures: 3, consecutiveSuccesses: 0, version: 1 };
  state = transitionHealth(state, { success: true, latencyMs: 8, httpStatus: 200 }, monitor);
  assert.equal(state.status, HealthStatus.UNHEALTHY);
  state = transitionHealth(state, { success: true, latencyMs: 8, httpStatus: 200 }, monitor);
  assert.equal(state.status, HealthStatus.HEALTHY);
});
