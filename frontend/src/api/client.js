export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const GATEWAY_BASE_URL = API_BASE_URL;
const storedResponses = new Map();

export class ApiError extends Error {
  constructor(message, status, code, requestId, details) { super(message); this.status = status; this.code = code; this.requestId = requestId; this.details = details; }
}

export const createApiClient = (getToken) => {
  const request = async (path, options = {}, refreshedToken = false) => {
    const method = options.method ?? 'GET';
    const url = `${API_BASE_URL}${path}`;
    const cached = storedResponses.get(url);
    const token = await getToken(refreshedToken);
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (method === 'GET' && cached?.etag) headers.set('If-None-Match', cached.etag);
    const response = await fetch(url, { ...options, method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    if (response.status === 304 && cached) return cached.data;
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      // A just-refreshed identity token resolves normal expiry and claim-update
      // races without ever retrying after an authenticated application request.
      if (!refreshedToken && response.status === 401 && payload?.error?.code === 'INVALID_TOKEN' && token) return request(path, options, true);
      throw new ApiError(payload?.error?.message ?? 'Relay could not complete the request.', response.status, payload?.error?.code, payload?.requestId, payload?.error?.details);
    }
    if (method === 'GET') storedResponses.set(url, { etag: response.headers.get('ETag'), data: payload });
    return payload;
  };
  return {
    get: (path, options = {}) => request(path, options),
    post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' })
  };
};
