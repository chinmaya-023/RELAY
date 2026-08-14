import { createApp } from './relayApp.js';

// Portable request handler for runtimes that invoke an Express application directly.
// It deliberately does not start the in-process monitoring scheduler.
const { app } = createApp();

export default app;
