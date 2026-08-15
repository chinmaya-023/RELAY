# Relay API and gateway

Requires Node.js 22.

## Run this service independently

```powershell
cd backend
npm install
npm run dev
npm run start
```

Set the values from `.env.example` in `backend/.env`. In production, set `CLIENT_ORIGINS` to the exact frontend URL and deploy this service behind HTTPS. Both `/api/*` and public gateway routes at `/g/{gateway-name}/*` are served by this backend.

For serverless deployment, set the project Root Directory to `backend`. The default Express export is in `src/app.js`; no adapter or routing file is required. Use Node.js 22 or later in the deployment settings.

## Control-plane API

Authenticated API routes live under `/api`. Interactive sessions use `Authorization: Bearer <token>`. Machine clients can use `X-Relay-API-Key: relay_...`; scoped keys are limited to the project they were created for.

- `/api/projects` - project CRUD
- `/api/projects/:id/backends`, `/api/backends/:id` - backend registration and test
- `/api/backends/:id/monitor` - health and keep-alive policy
- `/api/projects/:id/gateway` - gateway enablement and in-memory rate-limit policy
- `/api/projects/:id/failover` - conservative health-driven routing policy
- `/api/projects/:id/{alerts,logs,events}` - operational data
- `/api/api-keys` - create, list, and revoke scoped API keys
- `/api/account/deletion/request` - owner-reviewed permanent account-deletion request
- `/api/admin/account-deletion-requests/:uid` - Relay owner approval or rejection of a deletion request
- `DELETE /api/admin/users/:uid` - Relay owner direct account deletion (requires the selected account email in the JSON body)

Account deletion requires the signed-in account email and a recent sign-in to submit a request. Requests are visible only to Relay owners and are permanently executed only after an owner explicitly approves them. This workflow does not depend on transactional email delivery.

All versioned resources return deterministic ETags and honor `If-None-Match` with `304 Not Modified`.

## Gateway

Public data-plane traffic uses `/g/{gateway-name}/*` (for example, `/g/payments-api/v1/status`). The destination always comes from the project's registered backend, never from a request URL. A gateway cannot be enabled until the project has a registered backend and a unique gateway name.

Before registration and immediately before every outbound connection, Relay validates the origin's scheme, resolves DNS, denies private/loopback/link-local/metadata addresses, and connects to the validated IP. GET and HEAD health checks may follow a small, revalidated redirect chain; writes are not automatically retried.

When `RELAY_GATEWAY_SIGNING_SECRET` is set, outbound gateway calls include `X-Relay-Timestamp` and an HMAC-SHA256 `X-Relay-Signature`. Configure the origin to verify those values; the secret is never sent to the browser.

Gateway calls have per-client/path, per-project, and global emergency rate limits. Requests with oversized URLs or headers are rejected before routing. Relay strips client-supplied forwarding and Relay-control headers, never returns the selected backend ID, and does not forward upstream redirect locations or authentication challenges.

Production requires HTTPS backend origins by default. `RELAY_ALLOW_HTTP_BACKENDS=true` is available only for explicitly approved development use.

The current rate limiter is process-local. Deploy Redis-backed rate limiting before operating multiple gateway instances.
