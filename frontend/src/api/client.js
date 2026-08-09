export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const GATEWAY_BASE_URL = (import.meta.env.VITE_GATEWAY_BASE_URL ?? API_BASE_URL).replace(/\/$/, '');
const storedResponses = new Map();

export class ApiError extends Error {
  constructor(message, status, code, requestId) { super(message); this.status = status; this.code = code; this.requestId = requestId; }
}

export const createApiClient = (getToken) => {
  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET';
    const url = `${API_BASE_URL}${path}`;
    const cached = storedResponses.get(url);
    const token = await getToken();
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (method === 'GET' && cached?.etag) headers.set('If-None-Match', cached.etag);
    const response = await fetch(url, { ...options, method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    if (response.status === 304 && cached) return cached.data;
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) throw new ApiError(payload?.error?.message ?? 'Relay could not complete the request.', response.status, payload?.error?.code, payload?.requestId);
    if (method === 'GET') storedResponses.set(url, { etag: response.headers.get('ETag'), data: payload });
    return payload;
  };
  return { get: (path) => request(path), post: (path, body) => request(path, { method: 'POST', body }), patch: (path, body) => request(path, { method: 'PATCH', body }), delete: (path) => request(path, { method: 'DELETE' }) };
};
