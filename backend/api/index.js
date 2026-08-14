import app from '../src/function.js';

// This is the only Vercel Function entry point. Local development starts
// src/localServer.js, which is intentionally outside Vercel's entry-file names.
export default function handler(request, response) {
  return app(request, response);
}
