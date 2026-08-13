# Relay frontend

This is the standalone React/Vite dashboard. It can be deployed independently from the Relay API.

```powershell
cd frontend
npm install
npm run dev
npm run build
```

Before building, copy `.env.example` to `.env` and configure the identity-client values and backend URL:

```env
VITE_API_BASE_URL=https://api.example.com
```

Publish `dist/` as a single-page application. The included redirect rule serves `index.html` for application routes such as `/login` and `/register`; if your host uses another syntax, configure the equivalent fallback there.
