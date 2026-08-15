import { AppError } from '../lib/errors.js';
import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { readIncomingBody, requestExternal } from '../services/outboundRequest.js';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length']);
const FORWARDED_RESPONSE_HEADERS = new Set(['content-type', 'cache-control', 'etag', 'last-modified', 'location', 'www-authenticate', 'retry-after']);
const GATEWAY_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

const forwardedRequestHeaders = (headers) => Object.fromEntries(Object.entries(headers)
  .filter(([key, value]) => !HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined)
  .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]));

const resolveTarget = (backend, request) => {
  const suffix = request.url.startsWith('/') ? request.url.slice(1) : request.url;
  const base = backend.originUrl.endsWith('/') ? backend.originUrl : `${backend.originUrl}/`;
  return new URL(suffix, base).toString();
};

const signedOriginHeaders = ({ requestId, projectId, method, target }) => {
  if (!env.gatewaySigningSecret) return {};
  const timestamp = String(Date.now());
  const payload = `${requestId}.${projectId}.${timestamp}.${method}.${new URL(target).pathname}`;
  const signature = createHmac('sha256', env.gatewaySigningSecret).update(payload).digest('hex');
  return { 'x-relay-timestamp': timestamp, 'x-relay-signature': `sha256=${signature}` };
};

export const createGatewayHandler = ({ resources, failoverService, rateLimiter }) => async (request, response, next) => {
  try {
    if (!GATEWAY_METHODS.has(request.method)) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'This HTTP method is not supported by the gateway.');
    const projectId = request.relayProjectId ?? request.params.projectId;
    if (!projectId) throw new AppError(404, 'GATEWAY_PROJECT_NOT_FOUND', 'Gateway project was not found.');
    const config = await resources.gatewayConfig(projectId);
    if (!config?.enabled) throw new AppError(404, 'GATEWAY_DISABLED', 'Gateway is not enabled for this project.');
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
    const limit = rateLimiter.take(`${projectId}:${clientIp}:${request.path}`, config.rateLimit);
    response.set({ 'X-RateLimit-Remaining': String(limit.remaining), 'X-RateLimit-Reset': String(Math.floor(limit.resetAt / 1000)) });
    const backend = await failoverService.selectedBackend(projectId);
    const body = await readIncomingBody(request);
    const target = resolveTarget(backend, request);
    const upstream = await requestExternal({
      url: target,
      method: request.method,
      headers: { ...forwardedRequestHeaders(request.headers), 'x-relay-request-id': request.id, 'x-relay-project-id': projectId, ...signedOriginHeaders({ requestId: request.id, projectId, method: request.method, target }), ...(body.length ? { 'content-length': String(body.length) } : {}) },
      body,
      timeoutMs: 15_000,
      redirects: ['GET', 'HEAD'].includes(request.method) ? 2 : 0
    });
    for (const [key, value] of Object.entries(upstream.headers)) if (FORWARDED_RESPONSE_HEADERS.has(key.toLowerCase()) && value) response.set(key, value);
    response.set({ 'X-Relay-Backend-ID': backend.id, 'X-Relay-Routing-Mode': (await resources.routingConfig(projectId)).state?.mode ?? 'PRIMARY' });
    return response.status(upstream.status).send(upstream.body);
  } catch (error) { return next(error); }
};
