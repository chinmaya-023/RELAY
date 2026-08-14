# Relay

Relay is a developer reliability platform for monitoring registered backends, providing a controlled gateway, and applying conservative health-based failover. It never behaves as an open proxy.

Relay requires Node.js 22.

## Repository layout

- `frontend/` - React, Vite, Tailwind CSS, and client authentication
- `backend/` - Express API, identity administration, gateway, monitoring scheduler, and tests

The two folders are independently deployable. The frontend communicates with the backend and gateway through `VITE_API_BASE_URL`.

## Separate frontend and backend deployment

Deploy `frontend/` and `backend/` as two separate services. They do not need to run from the repository root.

### Frontend

```powershell
cd frontend
npm install
npm run dev
npm run build
```

Copy `frontend/.env.example` to `frontend/.env`. In production, set `VITE_API_BASE_URL` to the deployed backend URL, for example `https://api.example.com`.

### Backend

```powershell
cd backend
npm install
npm run dev
npm run start
```

Copy `backend/.env.example` to `backend/.env` and configure the identity-service credentials, Relay secrets, and `CLIENT_ORIGINS` with the exact frontend URL. The backend and gateway share one service and listen on `PORT` (default `4000`).

### Run both locally

From the repository root, `npm install` followed by `npm run dev` starts both workspaces together. This is only a convenience command; it is not required for deployment.

## Commands

- Root: `npm run dev`, `npm run lint`, `npm test` - convenience commands for both workspaces
- `frontend/`: `npm run dev`, `npm run build`, `npm run lint`
- `backend/`: `npm run dev`, `npm run start`, `npm test`, `npm run lint`

## Authentication

Relay uses managed email/password and Google sign-in. Email/password accounts must verify their email address before the frontend or backend grants access. Password recovery uses the identity service's secure, time-limited recovery-email flow; Relay does not create or store its own password-reset codes.

Configure Email/Password and Google in the identity service, set a password policy, enable email-enumeration protection, and authorize every frontend origin that can use sign-in or verification links.

## Monitoring alerts

New monitors check every 10 minutes by default, make up to five probe attempts, and wait two minutes between retries. Relay applies the configured failure threshold only after a full probe cycle fails, records the incident in the dashboard, and sends one notification when the backend transitions to `UNHEALTHY`.

Configure the trusted email-delivery integration described in `backend/.env.example` before enabling email alerts. Relay obtains the destination from the verified project owner and writes delivery requests only from trusted backend code; until delivery is configured, Relay keeps the dashboard alert and records email delivery as unavailable.

## Relay owner console

Set `RELAY_ADMIN_EMAILS` in `backend/.env` to a comma-separated list of verified account emails. Those accounts receive an **Admin** navigation entry with fleet-wide project and account visibility, plus the ability to suspend and restore accounts. This access is enforced by the backend; never expose the setting in frontend environment variables.

## Security

See [SECURITY.md](SECURITY.md) for the implemented controls, required identity-service settings, and operational hardening guidance. See [backend/README.md](backend/README.md) for API and gateway behavior.
