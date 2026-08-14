import express from 'express';

const serviceUnavailable = (response) => response
  .set('Cache-Control', 'no-store')
  .status(503)
  .json({
    success: false,
    error: {
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      message: 'This service is temporarily unavailable. Please try again shortly.'
    }
  });

export const createRuntimeApp = ({ loadCoreApp = () => import('./coreApp.js').then(({ createApp }) => createApp().app) } = {}) => {
  const app = express();
  let coreAppPromise;

  const coreApp = () => {
    if (!coreAppPromise) {
      coreAppPromise = loadCoreApp().catch((error) => {
        coreAppPromise = undefined;
        throw error;
      });
    }
    return coreAppPromise;
  };

  // Keep availability checks independent from optional providers and integrations.
  app.get(['/', '/health', '/healthz'], (_request, response) => response.json({ status: 'ok', message: 'RELAY SERVER' }));

  app.use(async (request, response, next) => {
    try {
      return (await coreApp())(request, response, next);
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'core_application_unavailable',
        timestamp: new Date().toISOString(),
        code: error?.code ?? 'MODULE_LOAD_FAILED'
      }));
      return serviceUnavailable(response);
    }
  });

  return app;
};

export default createRuntimeApp();
