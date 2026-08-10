# Relay frontend

This is the standalone React/Vite dashboard. It can be deployed independently from the Relay API.

```powershell
cd frontend
npm install
npm run dev       # local development at http://localhost:5173
npm run build     # production files in dist/
```

Before building, copy `.env.example` to `.env` and configure Firebase plus the deployed backend URLs:

```env
VITE_API_BASE_URL=https://api.example.com
```

The host must serve `dist/` as a single-page application and rewrite unknown application paths to `index.html`, so direct links such as `/projects/:projectId/monitoring` continue to work.
