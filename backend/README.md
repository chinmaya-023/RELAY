# Relay API and gateway

## Control-plane API

Authenticated API routes live under `/api`. Firebase ID tokens use `Authorization: Bearer <token>`. Machine clients can use `X-Relay-API-Key: relay_…`; scoped keys are limited to the project they were created for.

- `/api/projects` — project CRUD
- `/api/projects/:id/backends`, `/api/backends/:id` — backend registration and test
- `/api/backends/:id/monitor` — health and keep-alive policy
- `/api/projects/:id/gateway` — gateway enablement and in-memory rate-limit policy
- `/api/projects/:id/failover` — conservative health-driven routing policy
- `/api/projects/:id/{usage,alerts,logs,events}` — operational data
- `/api/api-keys` — create, list, and revoke scoped API keys

All versioned resources return deterministic ETags and honor `If-None-Match` with `304 Not Modified`.

## Gateway

Public data-plane traffic uses `/p/{projectId}/*` (for example, `/p/prj_123/v1/status`). The destination always comes from the project’s registered backend, never from a request URL.

Before registration and immediately before every outbound connection, Relay validates the origin’s scheme, resolves DNS, denies private/loopback/link-local/metadata addresses, and connects to the validated IP. GET and HEAD health checks may follow a small, revalidated redirect chain; writes are not automatically retried.

When `RELAY_GATEWAY_SIGNING_SECRET` is set, outbound gateway calls include `X-Relay-Timestamp` and an HMAC-SHA256 `X-Relay-Signature`. Configure the origin to verify those values; the secret is never sent to the browser.

The current rate limiter is process-local. Deploy Redis-backed rate limiting before operating multiple gateway instances.
