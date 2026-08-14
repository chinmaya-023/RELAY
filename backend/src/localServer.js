import { createApp } from './relayApp.js';
import { env, hasFirebaseConfiguration } from './config/env.js';
import { MonitoringScheduler } from './services/scheduler.js';
import { logger } from './lib/logger.js';

const { app, services } = createApp();
const scheduler = hasFirebaseConfiguration ? new MonitoringScheduler(services.repository, services.monitoringService) : null;
const server = app.listen(env.port, () => {
  logger.info('relay_api_started', { port: env.port, firebaseConfigured: hasFirebaseConfiguration });
  if (scheduler) scheduler.start();
  else logger.warn('scheduler_not_started', { reason: 'Firebase is not configured.' });
});

const shutdown = (signal) => {
  logger.info('relay_api_stopping', { signal });
  scheduler?.stop();
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
