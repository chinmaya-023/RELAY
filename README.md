# Relay

Relay is a developer reliability platform for monitoring registered backends, providing a controlled gateway, and applying conservative health-based failover. It never behaves as an open proxy.

## Repository layout

- `frontend/` — React, Vite, Tailwind CSS, and Firebase client authentication
- `backend/` — Express API, Firebase Admin, gateway, monitoring scheduler, and tests

The two folders are independently deployable. The frontend communicates with the backend and gateway through `VITE_API_BASE_URL`.

## Separate frontend and backend deployment

Deploy `frontend/` and `backend/` as two separate services. They do not need to run from the repository root.

### Frontend

```powershell
cd frontend
npm install
npm run dev       # local development at http://localhost:5173
npm run build     # production artifact in frontend/dist
```

Copy `frontend/.env.example` to `frontend/.env`. In production, set `VITE_API_BASE_URL` to the deployed backend URL, for example `https://api.example.com`.

### Backend

```powershell
cd backend
npm install
npm run dev       # local development with file watching
npm run start     # production server
```

Copy `backend/.env.example` to `backend/.env` and configure Firebase Admin credentials, Relay secrets, and `CLIENT_ORIGINS` with the exact deployed frontend URL. The backend and gateway share one service and listen on `PORT` (default `4000`).

### Run both locally

From the repository root, `npm install` followed by `npm run dev` starts both workspaces together. This is only a convenience command; it is not required for deployment.

## Commands

- Root: `npm run dev`, `npm run lint`, `npm test` — convenience commands for both workspaces
- `frontend/`: `npm run dev`, `npm run build`, `npm run lint`
- `backend/`: `npm run dev`, `npm run start`, `npm test`, `npm run lint`

## Authentication

Relay uses Firebase Authentication for email/password and Google sign-in. Email/password accounts must verify their email address before the frontend or backend grants access. Password recovery uses Firebase’s secure, time-limited recovery-email flow; Relay does not create or store its own password-reset OTPs.

Configure Email/Password and Google in the Firebase project, set a Firebase password policy, enable email-enumeration protection, and add every frontend origin to Firebase Authentication’s authorized domains.

## Monitoring alerts

New monitors check every 10 minutes by default, make up to five probe attempts, and wait two minutes between retries. Relay applies the configured failure threshold only after a full probe cycle fails, records the incident in the dashboard, and sends one notification when the backend transitions to `UNHEALTHY`.

For outage email, install Firebase's Trigger Email extension, configure it to watch the `relayAlertMail` Firestore collection, and set `FIREBASE_TRIGGER_EMAIL_ENABLED=true` in `backend/.env`. Relay obtains the destination from the verified Firebase Authentication project owner and writes the message only from trusted backend code. The extension then handles delivery through its configured mail provider; until it is enabled, Relay keeps the dashboard alert and records the email delivery as not configured.

## Relay owner console

Set `RELAY_ADMIN_EMAILS` in `backend/.env` to a comma-separated list of verified Firebase account emails. Those accounts receive an **Admin** navigation entry with fleet-wide project and account visibility, plus the ability to suspend and restore accounts. This access is enforced by the backend; never expose the setting in frontend environment variables.

## Security

See [SECURITY.md](SECURITY.md) for the implemented controls, required Firebase settings, and operational hardening guidance. See [backend/README.md](backend/README.md) for API and gateway behavior.
