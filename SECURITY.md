# Relay security posture

Relay follows a defence-in-depth model. Firebase Authentication owns user credentials; Relay verifies Firebase ID tokens on the backend and never stores user passwords.

## Implemented controls

- Email/password users receive a verification email at registration and cannot use the frontend or protected API until the verified Firebase claim is present.
- Password recovery uses Firebase’s secure recovery-email flow and returns a uniform user-facing response to reduce account enumeration.
- Google sign-in uses Firebase’s provider flow, with a redirect fallback when a pop-up is blocked.
- Browser authentication uses Firebase ID tokens in the `Authorization` header, not ambient cookies. State-changing API requests also validate allowed browser origins as CSRF defence in depth.
- API keys are scoped, project-restricted, revocable, and SHA-256 hashed with a server-only pepper. Raw keys are displayed once.
- Express disables `X-Powered-By`, applies Helmet headers, a restrictive API CSP, HSTS in production, `no-referrer`, MIME-sniffing protection, and anti-framing policy.
- API mutations accept JSON only; request bodies are limited to 1 MB. Request URLs and headers have explicit limits, and identifiers, URLs, and mutable fields are schema-validated before they reach business logic.
- Realtime Database and Firestore rules deny all browser reads and writes. Only the backend's Admin SDK may access Relay data or the trusted email-delivery queue.
- Every protected resource is checked against authenticated project membership and API-key scope, preventing IDOR/BOLA access by guessed IDs.
- The gateway routes only to registered origins, validates DNS/IP destinations before connection, blocks private and metadata networks, limits request and response size, constrains methods and redirects, and never accepts a destination URL from the client. Production requires HTTPS origin URLs by default.
- Gateway forwarding strips caller-supplied proxy and Relay-control headers. Relay does not disclose selected backend IDs, routing state, upstream redirect locations, or upstream authentication challenges.
- API and gateway requests are rate limited. Gateway limits are layered per client/path, per project, and globally; in-memory limits are bounded to resist key-space memory exhaustion. Use shared rate limiting before scaling beyond one process.
- Relay creates a server-generated request ID for every request. It is returned in `X-Request-ID` and used in structured logs without allowing callers to forge the ID.
- React’s normal escaped rendering is used throughout; the codebase does not use `dangerouslySetInnerHTML`.

## Required configuration

1. Serve both frontend and backend only over HTTPS in production.
2. Configure exact `CLIENT_ORIGINS`; do not use wildcard origins with authenticated APIs.
3. In Firebase Authentication, enable Email/Password and Google, configure a password policy, enable email-enumeration protection, and register all frontend domains as authorized domains.
4. Keep `FIREBASE_PRIVATE_KEY`, `RELAY_API_KEY_PEPPER`, and `RELAY_GATEWAY_SIGNING_SECRET` only in `backend/.env` or an equivalent secret store.
5. Set a platform-level CSP header for the frontend that matches the Firebase domains used by the deployment. The HTML fallback CSP is intentionally restrictive.
6. Replace process-local cache and rate limiting with shared services before running multiple backend instances.
7. Deploy the included `database.rules.json` and `firestore.rules` before production. They intentionally deny all direct browser database access; Relay uses trusted backend code for every data operation.

## Security references

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [Firebase Authentication documentation](https://firebase.google.com/docs/auth)
- [Firebase Google sign-in for web](https://firebase.google.com/docs/auth/web/google-signin)
