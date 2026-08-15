import http from 'node:http';
import https from 'node:https';
import { AppError } from '../lib/errors.js';
import { parseOutboundUrl, resolvePublicDestination } from '../security/ssrf.js';

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const cancellationError = () => new AppError(499, 'REQUEST_CANCELLED', 'The request was cancelled.');

const readResponse = (response, maxBytes) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  response.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBytes) {
      response.destroy();
      reject(new AppError(502, 'ORIGIN_RESPONSE_TOO_LARGE', 'Origin response exceeded the configured gateway limit.'));
      return;
    }
    chunks.push(chunk);
  });
  response.on('end', () => resolve(Buffer.concat(chunks)));
  response.on('error', reject);
});

const requestOnce = async ({ url, address, method, headers, body, timeoutMs, maxResponseBytes, signal }) => new Promise((resolve, reject) => {
  const client = url.protocol === 'https:' ? https : http;
  const defaultPort = url.protocol === 'https:' ? '443' : '80';
  const hostnameHeader = url.port && url.port !== defaultPort ? `${url.hostname}:${url.port}` : url.hostname;
  let settled = false;
  let abort = () => undefined;
  const settle = (callback) => (value) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', abort);
    callback(value);
  };
  const fail = settle(reject);
  const succeed = settle(resolve);
  if (signal?.aborted) return fail(cancellationError());
  const request = client.request({
    protocol: url.protocol,
    hostname: address,
    port: url.port || defaultPort,
    method,
    path: `${url.pathname}${url.search}`,
    headers: { ...headers, host: hostnameHeader },
    servername: url.hostname,
    rejectUnauthorized: true,
    timeout: timeoutMs
  }, async (response) => {
    try {
      const responseBody = await readResponse(response, maxResponseBytes);
      succeed({ status: response.statusCode ?? 502, headers: response.headers, body: responseBody });
    } catch (error) { fail(error); }
  });
  abort = () => request.destroy(cancellationError());
  signal?.addEventListener('abort', abort, { once: true });
  request.on('timeout', () => request.destroy(new AppError(504, 'ORIGIN_TIMEOUT', 'Origin request timed out.')));
  request.on('error', (error) => fail(error instanceof AppError ? error : new AppError(502, 'ORIGIN_UNAVAILABLE', 'Origin request failed.')));
  if (body?.length) request.write(body);
  request.end();
});

export const requestExternal = async ({ url: rawUrl, method = 'GET', headers = {}, body, timeoutMs = 10_000, redirects = 0, maxResponseBytes = MAX_RESPONSE_BYTES, signal }) => {
  let url = parseOutboundUrl(rawUrl);
  for (let attempt = 0; attempt <= redirects; attempt += 1) {
    if (signal?.aborted) throw cancellationError();
    // Resolve immediately before every connection and connect to the validated IP to prevent DNS rebinding.
    const destination = await resolvePublicDestination(url);
    const response = await requestOnce({ url, address: destination.addresses[0].address, method, headers, body, timeoutMs, maxResponseBytes, signal });
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location && attempt < redirects) {
      if (!['GET', 'HEAD'].includes(method.toUpperCase())) return response;
      url = new URL(location, url);
      continue;
    }
    return { ...response, finalUrl: url.toString() };
  }
  throw new AppError(502, 'ORIGIN_REDIRECT_LIMIT', 'Origin exceeded the redirect limit.');
};

export const readIncomingBody = (request, maxBytes = 1_048_576) => new Promise((resolve, reject) => {
  const declared = Number(request.get('content-length') ?? 0);
  if (declared > maxBytes) return reject(new AppError(413, 'REQUEST_TOO_LARGE', 'Request exceeds the gateway body limit.'));
  const chunks = [];
  let size = 0;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBytes) {
      request.destroy();
      reject(new AppError(413, 'REQUEST_TOO_LARGE', 'Request exceeds the gateway body limit.'));
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => resolve(Buffer.concat(chunks)));
  request.on('error', reject);
});
