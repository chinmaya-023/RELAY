import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createRuntimeApp } from '../src/app.js';

const withServer = async (app, callback) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

test('health checks remain available when the optional application stack cannot load', async () => {
  let loadAttempts = 0;
  const app = createRuntimeApp({
    loadCoreApp: async () => {
      loadAttempts += 1;
      throw new Error('optional provider is unavailable');
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', message: 'RELAY SERVER' });
  });
  assert.equal(loadAttempts, 0);
});

test('requests needing the optional application stack receive a safe 503 response', async () => {
  const app = createRuntimeApp({ loadCoreApp: async () => { throw new Error('optional provider is unavailable'); } });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        message: 'This service is temporarily unavailable. Please try again shortly.'
      },
      requestId: response.headers.get('x-request-id')
    });
    assert.match(response.headers.get('x-request-id'), /^relay_[0-9a-f-]{36}$/);
  });
});
