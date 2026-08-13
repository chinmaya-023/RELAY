import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRequireAuth } from './middleware/auth.js';
import { requestId } from './lib/requestId.js';
import { FirebaseRepository } from './repositories/firebaseRepository.js';
import { ResourceService } from './services/resourceService.js';
import { FailoverService } from './services/failoverService.js';
import { MonitoringService } from './services/monitoringService.js';
import { AlertNotificationService } from './services/alertNotificationService.js';
import { MemoryRateLimiter } from './security/rateLimiter.js';
import { createProjectRouter } from './routes/projects.js';
import { createBackendRouter } from './routes/backends.js';
import { createMonitoringRouter } from './routes/monitoring.js';
import { createConfigurationRouter } from './routes/configuration.js';
import { createEventRouter } from './routes/events.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { ApiKeyService } from './services/apiKeyService.js';
import { createApiKeyRouter } from './routes/apiKeys.js';
import { AdminService } from './services/adminService.js';
import { createAdminRouter } from './routes/admin.js';
import { AccountDeletionService } from './services/accountDeletionService.js';
import { createAccountRouter } from './routes/account.js';
import { createGatewayHandler } from './gateway/gatewayHandler.js';
import { createRateLimitMiddleware, requireAllowedBrowserOrigin, requireJsonBody } from './middleware/requestSecurity.js';

export const createApp = (dependencies = {}) => {
  const repository = dependencies.repository ?? new FirebaseRepository();
  const resources = dependencies.resources ?? new ResourceService(repository);
  const failoverService = dependencies.failoverService ?? new FailoverService(repository);
  const alertNotificationService = dependencies.alertNotificationService ?? new AlertNotificationService(repository);
  const monitoringService = dependencies.monitoringService ?? new MonitoringService(repository, failoverService, { alertNotificationService });
  const rateLimiter = dependencies.rateLimiter ?? new MemoryRateLimiter();
  const apiRateLimiter = dependencies.apiRateLimiter ?? new MemoryRateLimiter();
  const authenticatedApiRateLimiter = dependencies.authenticatedApiRateLimiter ?? new MemoryRateLimiter();
  const apiKeyService = dependencies.apiKeyService ?? new ApiKeyService(repository);
  const adminService = dependencies.adminService ?? new AdminService(repository);
  const accountDeletionService = dependencies.accountDeletionService ?? new AccountDeletionService(repository);
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: env.nodeEnv === 'production' ? { maxAge: 15_552_000, includeSubDomains: true } : false
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-None-Match', 'X-Request-ID', 'X-Relay-API-Key'],
    credentials: false,
    maxAge: 600
  }));
  app.get(['/', '/health'], (_request, response) => response.json({ status: 'ok', message: 'RELAY SERVER' }));
  app.get('/healthz', (_request, response) => response.json({ status: 'ok', message: 'RELAY SERVER' }));
  app.get('/api/status', (_request, response) => response.json({ success: true, data: { service: 'relay-api', authentication: 'configured' } }));

  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', requireJsonBody);
  app.use('/api', createRateLimitMiddleware(apiRateLimiter, env.apiRateLimit, (request) => `api-ip:${request.ip}`));
  app.use('/api', requireAllowedBrowserOrigin(env.clientOrigins));
  app.use('/api', createRequireAuth(apiKeyService));
  app.use('/api', createRateLimitMiddleware(authenticatedApiRateLimiter, env.apiRateLimit, (request) => `api-identity:${request.user.apiKeyId ?? request.user.uid}`));
  app.use('/api', createDashboardRouter({ repository }));
  app.use('/api/projects', createProjectRouter({ repository, resources }));
  app.use('/api', createBackendRouter({ repository, resources, monitoringService }));
  app.use('/api', createMonitoringRouter({ repository, resources }));
  app.use('/api', createConfigurationRouter({ repository, resources, failoverService }));
  app.use('/api', createEventRouter({ repository, resources }));
  app.use('/api/api-keys', createApiKeyRouter({ repository, apiKeyService }));
  app.use('/api/account', createAccountRouter({ accountDeletionService }));
  app.use('/api/admin', createAdminRouter({ adminService }));
  app.use('/p/:projectId', createGatewayHandler({ resources, failoverService, rateLimiter }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, services: { repository, resources, failoverService, monitoringService, alertNotificationService, rateLimiter, apiRateLimiter, authenticatedApiRateLimiter, apiKeyService, adminService, accountDeletionService } };
};

export default createApp().app;
