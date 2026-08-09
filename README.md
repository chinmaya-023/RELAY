# Relay

Relay is a developer reliability platform for monitoring registered backends, providing a controlled gateway, and applying conservative health-based failover. It never bypasses provider quotas or behaves as an open proxy.

## Repository layout

- `frontend/` — React, Vite, Tailwind CSS, Firebase client authentication
- `backend/` — Express API, Firebase Admin, gateway, monitoring scheduler, and tests

The two folders are independently deployable. The frontend communicates with the backend through `VITE_API_BASE_URL`; gateway traffic uses `VITE_GATEWAY_BASE_URL`.

## Local setup

1. Copy `frontend/.env.example` to `frontend/.env` and add the public Firebase and API configuration.
2. Copy `backend/.env.example` to `backend/.env` and add server-only Firebase Admin credentials and Relay secrets.
3. Run `npm install` from the repository root.
4. Run `npm run dev`.

The frontend runs at `http://localhost:5173`; the backend and gateway run at `http://localhost:4000`.

## Commands

- `npm run dev` — run frontend and backend together
- `npm run dev:frontend` — run only the frontend
- `npm run dev:backend` — run only the backend
- `npm run build` — build the frontend artifact
- `npm run lint` — lint both workspaces
- `npm test` — run backend unit tests

## Authentication

Relay uses Firebase Authentication for email/password and Google sign-in. Email/password accounts must verify their email address before the frontend or backend grants access. Password recovery uses Firebase’s secure, time-limited recovery email flow; Relay does not create or store its own password-reset OTPs.

Configure Email/Password and Google in the Firebase project, set a Firebase password policy, enable email-enumeration protection, and add every frontend origin to Firebase Authentication’s authorized domains.

## Monitoring alerts

Each monitor makes up to three probe attempts by default, waiting five seconds between retries. Relay applies the configured failure threshold only after a full probe cycle fails, records the incident in the dashboard, and sends one notification when the backend transitions to `UNHEALTHY`.

For outage email, install Firebase's Trigger Email extension, configure it to watch the `relayAlertMail` Firestore collection, and set `FIREBASE_TRIGGER_EMAIL_ENABLED=true` in `backend/.env`. Relay obtains the destination from the verified Firebase Authentication project owner and writes the message only from trusted backend code. The extension then handles delivery through its configured mail provider; until it is enabled, Relay keeps the dashboard alert and records the email delivery as not configured.

## Security

See [SECURITY.md](SECURITY.md) for the implemented controls, required Firebase settings, and operational hardening guidance. See [backend/README.md](backend/README.md) for API and gateway behavior.
