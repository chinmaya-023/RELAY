import app from '../src/function.js';

// Vercel invokes this Express application as one serverless function.
// The local HTTP server and in-process monitoring scheduler remain in src/server.js.
export default function handler(request, response) {
  return app(request, response);
}
