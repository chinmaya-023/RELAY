import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(moduleDirectory, '../../.env') });

const asInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const asOrigins = (value) => value.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
const asEmails = (value) => value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: asInteger(process.env.PORT, 4000),
  clientOrigins: asOrigins(process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'),
  allowLocalAuth: process.env.RELAY_ALLOW_LOCAL_AUTH === 'true',
  localUserId: process.env.RELAY_LOCAL_USER_ID ?? '',
  adminEmails: asEmails(process.env.RELAY_ADMIN_EMAILS ?? ''),
  gatewaySigningSecret: process.env.RELAY_GATEWAY_SIGNING_SECRET ?? '',
  apiKeyPepper: process.env.RELAY_API_KEY_PEPPER ?? '',
  apiRateLimit: {
    windowSeconds: asInteger(process.env.API_RATE_LIMIT_WINDOW_SECONDS, 60),
    maxRequests: asInteger(process.env.API_RATE_LIMIT_MAX_REQUESTS, 300)
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    databaseURL: process.env.FIREBASE_DATABASE_URL ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
    triggerEmailEnabled: process.env.FIREBASE_TRIGGER_EMAIL_ENABLED === 'true',
    triggerEmailCollection: process.env.FIREBASE_TRIGGER_EMAIL_COLLECTION ?? 'relayAlertMail'
  }
});

export const hasFirebaseConfiguration = Boolean(env.firebase.projectId && env.firebase.databaseURL);
export const hasFirebaseTriggerEmailConfiguration = Boolean(hasFirebaseConfiguration && env.firebase.triggerEmailEnabled && env.firebase.triggerEmailCollection);

export const assertSafeDevelopmentAuth = () => {
  if (!env.allowLocalAuth) return;
  if (env.nodeEnv !== 'development' || !env.localUserId) {
    throw new Error('RELAY_ALLOW_LOCAL_AUTH requires NODE_ENV=development and RELAY_LOCAL_USER_ID.');
  }
};
