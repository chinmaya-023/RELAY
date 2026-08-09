export const HealthStatus = Object.freeze({ UNKNOWN: 'UNKNOWN', HEALTHY: 'HEALTHY', DEGRADED: 'DEGRADED', UNHEALTHY: 'UNHEALTHY', OFFLINE: 'OFFLINE' });

export const transitionHealth = (previous = {}, result, monitor, timestamp = Date.now()) => {
  const successful = result.success;
  const consecutiveFailures = successful ? 0 : (previous.consecutiveFailures ?? 0) + 1;
  const consecutiveSuccesses = successful ? (previous.consecutiveSuccesses ?? 0) + 1 : 0;
  let status = previous.status ?? HealthStatus.UNKNOWN;
  if (successful && consecutiveSuccesses >= monitor.recoveryThreshold) status = HealthStatus.HEALTHY;
  else if (!successful && consecutiveFailures >= monitor.failureThreshold) status = HealthStatus.UNHEALTHY;
  else if (!successful) status = HealthStatus.DEGRADED;
  return {
    ...previous,
    status,
    consecutiveFailures,
    consecutiveSuccesses,
    lastCheckAt: timestamp,
    lastSuccessAt: successful ? timestamp : previous.lastSuccessAt ?? null,
    lastFailureAt: successful ? previous.lastFailureAt ?? null : timestamp,
    lastLatencyMs: result.latencyMs,
    lastAttempts: result.attempts ?? 1,
    lastHttpStatus: result.httpStatus ?? null,
    lastErrorCode: result.errorCode ?? null,
    updatedAt: timestamp,
    version: (previous.version ?? 0) + 1
  };
};
